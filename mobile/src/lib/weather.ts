export type WeatherItem = {
  date: string;
  description: string;
  icon: keyof typeof WEATHER_ICON_TITLES;
  precipitationChance: number;
  temperatureC: number;
  temperatureMinC: number;
  temperatureMaxC: number;
};

type WeatherApiResponse = {
  current?: {
    temperature_2m: number;
    time: string;
    weather_code: number;
  };
  current_weather?: {
    temperature: number;
    weathercode: number;
    time: string;
  };
  daily?: {
    time?: string[];
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
    precipitation_probability_max?: number[];
    weather_code?: number[];
    weathercode?: number[];
  };
};

export const WORKSHOP_COORDINATES = {
  latitude: -38.0701,
  longitude: 145.4850,
  timezone: 'Australia/Melbourne',
} as const;

export type WorkshopWeather = {
  current: WeatherItem;
  nextSeven: WeatherItem[];
  source: string;
};

export const WEATHER_ICON_TITLES = {
  'sunny-outline': 'Clear',
  'partly-sunny-outline': 'Partly cloudy',
  'cloud-outline': 'Cloudy',
  'rainy-outline': 'Showers',
  'thunderstorm-outline': 'Storm',
} as const;

export function weatherIconFromCode(code: number): keyof typeof WEATHER_ICON_TITLES {
  if (code === 0) return 'sunny-outline';
  if (code >= 1 && code <= 3) return 'partly-sunny-outline';
  if ((code >= 45 && code <= 48) || (code >= 51 && code <= 57) || code === 61 || code === 63 || code === 65 || code === 80 || code === 81 || code === 82) return 'rainy-outline';
  if (code >= 71 && code <= 77) return 'cloud-outline';
  if (code >= 95 && code <= 99) return 'thunderstorm-outline';
  return 'cloud-outline';
}

function weatherTitleFromCode(code: number) {
  return WEATHER_ICON_TITLES[weatherIconFromCode(code)];
}

export function normaliseDateOnly(value: string | null | undefined) {
  if (!value) return null;
  return value.slice(0, 10);
}

export async function loadWorkshopWeather(signal?: AbortSignal): Promise<WorkshopWeather> {
  const { latitude, longitude, timezone } = WORKSHOP_COORDINATES;
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    timezone,
    temperature_unit: 'celsius',
    windspeed_unit: 'ms',
    precipitation_unit: 'mm',
    forecast_days: '8',
    current: 'temperature_2m,weather_code',
    daily: 'temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code',
  });

  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`, { signal });
  if (!response.ok) {
    throw new Error(`WEATHER_FETCH_FAILED:${response.status}`);
  }

  const payload = (await response.json()) as WeatherApiResponse;
  const days = payload.daily?.time ?? [];
  const maxs = payload.daily?.temperature_2m_max ?? [];
  const mins = payload.daily?.temperature_2m_min ?? [];
  const precip = payload.daily?.precipitation_probability_max ?? [];
  const codes = payload.daily?.weather_code ?? payload.daily?.weathercode ?? [];
  const current = payload.current
    ? {
      temperature: payload.current.temperature_2m,
      time: payload.current.time,
      weathercode: payload.current.weather_code,
    }
    : payload.current_weather;

  if (!current || days.length === 0 || maxs.length === 0 || mins.length === 0 || precip.length === 0 || codes.length === 0) {
    throw new Error('WEATHER_DATA_INCOMPLETE');
  }

  const forecast: WeatherItem[] = days.map((date, index) => {
    const weathercode = Number(codes[index] ?? 0);
    return {
      date,
      description: weatherTitleFromCode(weathercode),
      icon: weatherIconFromCode(weathercode),
      precipitationChance: Number(precip[index] ?? 0),
      temperatureC: Number(((Number(mins[index] ?? 0) + Number(maxs[index] ?? 0)) / 2).toFixed(1)),
      temperatureMinC: Number(Number(mins[index] ?? 0).toFixed(1)),
      temperatureMaxC: Number(Number(maxs[index] ?? 0).toFixed(1)),
    };
  });

  const currentCode = Number(current.weathercode ?? 0);
  const currentDate = normaliseDateOnly(current.time) ?? days[0] ?? '';
  return {
    current: {
      date: currentDate,
      description: weatherTitleFromCode(currentCode),
      icon: weatherIconFromCode(currentCode),
      precipitationChance: forecast.find((entry) => entry.date === currentDate)?.precipitationChance ?? 0,
      temperatureC: Number(Number(current.temperature ?? 0).toFixed(1)),
      temperatureMinC: 0,
      temperatureMaxC: 0,
    },
    nextSeven: forecast.slice(0, 8),
    source: new Date().toISOString(),
  };
}
