# Calendar weekday alignment

The previous repair corrected date calculations, but the phone picker still
placed all dates in one wrapping row of percentage widths. Yoga can wrap the
seventh cell at fractional widths. A reproduced case is a 216 point grid, where
the former layout places Sunday on the next line. That changes visible weekday
alignment even when the ISO date and accessible weekday label are correct.

The shared picker now renders explicit seven cell week rows with equal flex
columns. Heading columns use the same sizing. The example calendar uses the same
week generator. This applies to booking dates and the portal date fields that
reuse the picker. Existing date eligibility, booking horizon, saved dates,
confirmation events and customer bookings are unchanged.

Regression coverage checks every day in the complete Gregorian cycle from 2000
through 2399, 146097 dates, against independent integer calendar arithmetic.
Actual picker rendering, accessible weekday labels and date selection are checked
for every date from 2026 through 2038. Native layout is checked at 3201 integer
and fractional grid widths from 200 through 1000, at three screen scales, 9603
combinations. The former wrapping failure is reproduced by the regression test.
Leap day, month movement, unavailable dates and booking boundaries are covered.
The suites pass under Sydney, Los Angeles and Honolulu process time zones.

The existing website calendar already uses seven explicit CSS grid columns.
Its date only paths retain UTC calculations. The Gregorian cycle checks include
2026, 2027, leap year 2028 and the non leap century 2100.

The layout test dependency yoga-layout is pinned to 3.2.1 in mobile development
dependencies with the lockfile committed. The tests exercise the actual TSX
component and its styles, rather than just its date helper.
