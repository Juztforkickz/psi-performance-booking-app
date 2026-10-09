'use strict';

// Curated public facts only. Private mail, individual quotes and customer data
// must never be copied into this module or the browser build.
(function (root) {
  const VERIFIED_ON = '2026-10-09';
  // Matt approved these as starting guides, not fixed quotes or package inclusions.
  const PRICE_GUIDES = Object.freeze({
    service: 'Service & Report starts from AUD $423.50 including GST. PSI confirms the final price for your vehicle and the work required.',
    dyno: 'Dyno Tuning starts from AUD $649 including GST. PSI confirms the final price for your vehicle and the work required.',
  });
  const LINKS = Object.freeze({
    apple: { label: 'iPhone App Store', url: 'https://apps.apple.com/au/app/psi-performance-garage/id6806902732' },
    android: { label: 'Android Google Play', url: 'https://play.google.com/store/apps/details?id=com.psiperformance.booking' },
    enquiry: { label: 'Website enquiry', url: 'https://psiperformance.com.au/#booking-panel' },
    services: { label: 'Workshop services', url: 'https://psiperformance.com.au/pages/workshop-services-pakenham' },
    ev: { label: 'EV and hybrid services', url: 'https://psiperformance.com.au/pages/ev-hybrid' },
    shop: { label: 'PSI website shop', url: 'https://psiperformance.com.au/' },
    coding: { label: 'Coding information', url: 'https://psiperformance.com.au/pages/coding' },
  });
  const SOURCES = Object.freeze({
    website: 'PSI homepage, enquiry form and footer, checked 9 October 2026',
    workshop: 'PSI Workshop Services page, checked 9 October 2026',
    ev: 'PSI EV & Hybrid page, checked 9 October 2026',
    coding: 'PSI Coding page, compatibility information only, checked 9 October 2026',
    estimator: 'PSI Power Estimator, development notice checked 9 October 2026',
    stores: 'Public Australian Apple and Google Play listings, checked 9 October 2026',
    account: 'Current mobile account/index.tsx and account/sign-up.tsx, labels checked 9 October 2026',
    garage: 'Current mobile account setup and My Garage screens',
    booking: 'Current mobile booking.tsx, tabs/bookings.tsx and lib/booking.ts',
    pricingApproval: 'Matt confirmed Service & Report from AUD $423.50 and Dyno Tuning from AUD $649 on 9 October 2026. Starting guides only, with existing GST inclusive treatment. Exact prices and inclusions still require PSI review.',
    plus: 'Current mobile performance-plus.tsx and public Australian App Store description',
    mail: 'Anonymised recurring enquiry topics from selected PSI Outlook correspondence, March to October 2026. No individual prices approved.',
    boundary: 'Private Boost test scope and owner instructions. No connected inbox or production actions.',
  });
  const faq = (id, category, question, reply, sources, prompts = [], links = []) => Object.freeze({ id, category, question, reply, sources, prompts, links, verifiedOn: VERIFIED_ON });
  const FAQS = Object.freeze([
    faq('download', 'App', 'Where can I download the PSI app?', 'Download PSI Performance Garage for iPhone or Android. The app is the easiest way to keep your vehicles and booking requests together. Which phone do you use?', ['stores','booking'], ['I use an iPhone', 'I use Android', 'I already have the app'], ['apple','android']),
    faq('iphone', 'App', 'I use an iPhone', 'Open the iPhone App Store link, tap Get and open PSI Performance Garage. If it is already installed, tap Open. Next, sign in with your email code.', ['stores','account'], ['How do I create an account?', 'I already have an account'], ['apple']),
    faq('android', 'App', 'I use Android', 'Open the Google Play link, tap Install and open PSI Performance Garage. Use the same PSI email if you already have an account. Next, request your email sign in code.', ['stores','account'], ['How do I create an account?', 'I already have an account'], ['android']),
    faq('installed', 'App', 'I already have the app', 'Great. Sign in with your PSI email, then use Book ahead in Bookings. Choose Service & Report or Dyno Tuning and select your saved vehicle.', ['account','booking'], ['How do I sign in?', 'How do I book?', 'How do I add a vehicle?']),
    faq('signup', 'App', 'How do I create an account?', '1. Open PSI Performance Garage and the Account screen.\n2. Enter your email and tap Email my sign-in code.\n3. Enter the six digit email code and tap Verify and sign in.\n4. Add your name, mobile and vehicle details.\n5. Tap Save account details.\nNo password or paid subscription is needed to create your account.', ['account','plus'], ['Guide me through account setup', 'My code has not arrived', 'How do I book?']),
    faq('signin', 'App', 'How do I sign in?', 'Use the email already linked to your PSI account. Tap Email my sign-in code, enter the newest six digit code from your email, then tap Verify and sign in. No password is required.', ['account'], ['My code has not arrived', 'I forgot my password', 'How do I book?']),
    faq('password', 'App', 'I forgot my password', 'PSI uses an email code, so there is no PSI password to reset. Enter your account email and tap Email my sign-in code. Never send that code to Boost or anyone else.', ['account'], ['My code has not arrived', 'I cannot access my email']),
    faq('code-help', 'App', 'My code has not arrived', 'Check the email spelling and your junk folder. Wait for the resend timer, then use Request a new code. Enter only the newest code within 10 minutes. If it still fails, choose Message PSI. Do not share the code here.', ['account'], ['Message PSI', 'How do I create an account?']),
    faq('garage', 'App', 'How do I add a vehicle?', 'Finish your account profile with your mobile, vehicle registration, year, make and model. Save account details, then open My Garage. Use Add vehicle for another car. If PSI created a vehicle record, ask PSI to correct its verified details.', ['account','garage'], ['How do I book?', 'My vehicle record is missing']),
    faq('free', 'App', 'Is the app free?', 'Yes. Downloading the app, your profile, My Garage, enquiries and booking requests are free. Performance+ is optional for the fuller private workshop record and file archive. Workshop work is charged separately.', ['stores','plus'], ['What is Performance+?', 'How do I book?'], ['apple','android']),
    faq('plus', 'App', 'What is Performance+?', 'Performance+ opens the fuller private vehicle record, including available workshop photos, invoice copies, dyno files and supporting documents. It covers the vehicles in your PSI account. Only records PSI has published for your car appear.', ['plus'], ['What does Performance+ cost?', 'Is the app free?', 'How does the trial work?']),
    faq('plus-price', 'App', 'What does Performance+ cost?', 'The Australian guide is AUD $9.99 monthly or AUD $99.00 annually. Open Performance+ in the app to see the current store price and terms before choosing. It is optional and does not pay for servicing or workshop deposits.', ['plus','stores'], ['How does the trial work?', 'Is the app free?']),
    faq('trial', 'App', 'How does the trial work?', 'Completing your own verified PSI account starts one complimentary 14 day Performance+ trial. It takes no payment and does not renew automatically. After it ends, PSI Free remains available. Your app shows your own access status.', ['plus'], ['Is the app free?', 'What is Performance+?']),
    faq('restore', 'App', 'How do I restore Performance+?', 'Sign in to your existing PSI account, open Performance+ and choose Restore purchases using the store account that made the purchase. If access is still missing, choose Message PSI. Do not buy it again just to troubleshoot.', ['plus'], ['Message PSI']),
    faq('subscription-manage', 'App', 'How do I manage my subscription?', 'Open Performance+ and use Manage Apple subscription or Manage Google Play subscription for the store that billed you. The store shows your renewal and cancellation options. Boost cannot change or refund a subscription.', ['plus'], ['How do I restore Performance+?', 'Message PSI']),
    faq('records-guide', 'App', 'Where do I find workshop records?', 'Sign in and select the correct vehicle in My Garage or Reports. Available PSI records appear against that vehicle. Detailed files and the full archive use Performance+ access. If something is missing, PSI must check the account and vehicle match.', ['plus','garage'], ['My vehicle record is missing', 'What is Performance+?']),
    faq('booking', 'Booking', 'How do I book?', 'In the PSI app:\n1. Sign in and save your vehicle.\n2. Open Bookings, then Book ahead.\n3. Choose Service & Report or Dyno Tuning, then your vehicle.\n4. Complete the job, setup, contact and timing steps.\n5. Review and tap Submit request for PSI review.\nPSI confirms the scope and date. Prefer the website? Use Website enquiry.', ['booking','account'], ['Guide me through a booking', 'I need the app', 'Website enquiry'], ['apple','android','enquiry']),
    faq('website-enquiry', 'Booking', 'Can I enquire without the app?', 'Yes. Use Book an appointment on the PSI website. Choose General Enquiry / Service Booking, Dyno Tuning or Plan Builder, add your car and contact details, then Send enquiry. It is a request for PSI review, not a confirmed date or payment.', ['website'], ['How do I book in the app?', 'What is Plan Builder?'], ['enquiry']),
    faq('booking-choice', 'Booking', 'Which booking option should I choose?', 'Choose Service & Report for servicing, diagnostics, repairs or EV and hybrid checks. Choose Dyno Tuning for calibration and measured performance work. For a larger build idea, use Plan Builder in the website enquiry form.', ['booking','website'], ['How do I book?', 'What is Plan Builder?']),
    faq('confirmed', 'Booking', 'Is submitting a request a confirmed booking?', 'No. PSI reviews your request and preferred date first. Follow the approved booking instructions and any deposit request. The app shows the booking status after PSI verifies the required deposit.', ['booking'], ['How do deposits work?', 'How do I book?']),
    faq('deposit', 'Booking', 'How do deposits work?', 'No payment is taken when you send a booking request. After PSI approves a date, follow the deposit instructions issued for that booking. The amount is shown in your request. A transfer receipt alone is not confirmation that PSI has verified it.', ['booking'], ['Is submitting a request a confirmed booking?', 'Message PSI']),
    faq('payment', 'Booking', 'How do I pay for workshop work?', 'Use the payment instructions on your actual PSI booking or Xero invoice. Workshop payments are separate from Performance+ subscriptions. Boost cannot take card details, verify a transfer or mark an invoice paid.', ['booking','plus','boundary'], ['How do deposits work?', 'Message PSI']),
    faq('availability', 'Booking', 'What is your next available appointment?', 'PSI needs to confirm current availability. In the app, choose your preferred date or I’m flexible and submit the request. For an urgent enquiry, call 0433 431 781.', ['booking','website'], ['How do I book?', 'Website enquiry']),
    faq('arrival', 'Booking', 'Can I drop off outside normal hours?', 'The app lets you request an arrival arrangement, including before or after hours. PSI must agree to it first. Ask PSI for the approved drop off instructions rather than leaving the car or keys unarranged.', ['booking'], ['How do I book?', 'Message PSI']),
    faq('turnaround', 'Booking', 'How long will the work take?', 'That depends on the job, diagnosis and parts availability. PSI confirms timing after reviewing your car and scope. Include when you need the car back in your request. Boost cannot promise a same day finish.', ['workshop','mail'], ['How do I book?', 'Website enquiry']),
    faq('plan', 'Workshop', 'What is Plan Builder?', 'It is the website enquiry path for a build or upgrade idea. Select the areas you want to discuss, then your intended use, priority, timing, budget direction and current setup. PSI reviews the combination before recommending parts or quoting.', ['website'], ['Website enquiry', 'Do you build engines?'], ['enquiry']),
    faq('service', 'Workshop', 'What does Service & Report cover?', PRICE_GUIDES.service + ' Use it for servicing, inspection or a specific concern. Select what your car needs through Book ahead in the app.', ['booking','workshop','pricingApproval'], ['How do I book?', 'Does a service include spark plugs?', 'What does servicing cost?']),
    faq('service-inclusions', 'Workshop', 'Does a service include spark plugs?', 'Do not assume plugs, filters, fluids or extra repairs are all included in a starting price. PSI checks the vehicle, kilometres and service requirements, then confirms the inclusions and any additional work.', ['booking','mail'], ['What does servicing cost?', 'How do I book?']),
    faq('logbook', 'Workshop', 'Do you do logbook servicing?', 'Yes. PSI offers logbook and routine servicing. Include your make, model, year, kilometres and the service due so PSI can confirm the correct scope. Use Service & Report in the app.', ['workshop','mail','booking'], ['How do I book?', 'What does servicing cost?']),
    faq('diagnostics', 'Workshop', 'Can you diagnose a warning light or fault?', 'Yes. Describe the symptom, when it happens and what has already been checked or replaced. PSI inspects and tests before recommending repairs. Book Service & Report and select diagnostics. Boost cannot diagnose the cause from chat.', ['workshop','booking','mail'], ['How do I book?', 'I need a quote']),
    faq('brakes', 'Workshop', 'Do you do brakes and suspension?', 'Yes. PSI offers brake, steering and suspension work, including fault checks and wheel alignment. Tell us the car and whether you want a repair or upgrade. PSI confirms the suitable parts and scope.', ['workshop','ev','website'], ['How do I book?', 'I need a quote']),
    faq('cooling', 'Workshop', 'Do you check cooling systems?', 'Yes. Cooling concerns can be selected in Service & Report. Include the car and symptoms. EV and hybrid enquiries can include battery, inverter and motor cooling, subject to the vehicle and supported work.', ['ev','booking'], ['How do I book?', 'Do you service electric cars?']),
    faq('engine-build', 'Workshop', 'Do you build engines?', 'Yes. PSI offers engine builds, rebuilds and head and cam work. The plan depends on engine condition, supporting parts, fuel and intended use. Use website Plan Builder for a build proposal, or Service & Report for a fault assessment.', ['workshop','website','mail'], ['What is Plan Builder?', 'I need a quote']),
    faq('cam', 'Workshop', 'Can you help choose a cam package?', 'Yes. PSI matches cam and supporting parts to the engine, transmission, condition and how you use the car. A larger cam is not automatically the right choice. Include the current setup and goal in Plan Builder.', ['workshop','mail','website'], ['What does a cam package cost?', 'What is Plan Builder?']),
    faq('exhaust', 'Workshop', 'Do you supply and fit exhausts?', 'PSI can review exhaust supply and fitting. Specify the vehicle, engine and whether you want a rear section, full system, headers or a valved system. Fitting, tuning and any additional parts need to be included in the agreed quote.', ['website','mail'], ['I need an exhaust quote', 'Website enquiry']),
    faq('forced-induction', 'Workshop', 'Can you supply and fit a supercharger?', 'PSI can assess turbo and supercharger projects. Send the exact car, engine, current setup, fuel and intended use. Kit access, compatibility, supporting parts and tuning are confirmed individually, not assumed from the brand alone.', ['workshop','mail'], ['What is Plan Builder?', 'I need a quote']),
    faq('interchiller', 'Workshop', 'Do you fit interchillers or water meth systems?', 'PSI has handled interchiller and water meth installation enquiries. The right setup depends on the car, blower or turbo, cooling arrangement and intended use. PSI needs to confirm suitability and the complete installed scope.', ['website','mail'], ['I need a quote', 'What is Plan Builder?']),
    faq('dyno', 'Tuning', 'Do you do dyno tuning?', 'Yes. ' + PRICE_GUIDES.dyno + ' Use Dyno Tuning in the app and include your current setup and tuning goal.', ['workshop','booking','pricingApproval'], ['What details do I need for tuning?', 'How do I book?', 'What does a tune cost?']),
    faq('dyno-details', 'Tuning', 'What details do I need for tuning?', 'Include the engine and modifications, transmission, differential, injectors and pump, fuel, intake, exhaust, cam and any previous tune. If you do not know the setup, choose the PSI inspection option rather than guessing.', ['booking','website'], ['How do I book?', 'I need a quote']),
    faq('ecu-tcu', 'Tuning', 'Is transmission tuning included with an engine tune?', 'An engine ECU tune and transmission TCU tune are different work. Do not assume both are included. Give PSI the car, transmission and goal so compatibility and the combined scope can be quoted.', ['mail','website'], ['I need a tune quote', 'How do I book?']),
    faq('power', 'Tuning', 'How much power will my car make?', 'PSI must assess the exact setup before discussing a realistic result. Fuel, condition and supporting parts matter. No power or economy gain is guaranteed by Boost. Include your goal in a Dyno Tuning request.', ['workshop','estimator','booking'], ['What details do I need for tuning?', 'How do I book?']),
    faq('estimator', 'Tuning', 'Can I use the Power Estimator as a quote?', 'No. The website currently labels the Power Estimator a development preview and says its figures are not approved for customer quotations. Use it for initial context only, then ask PSI to assess your exact setup.', ['estimator'], ['What details do I need for tuning?', 'Website enquiry']),
    faq('fuel', 'Tuning', 'Can you tune for E85 or flex fuel?', 'The enquiry form accepts 98 RON, E85, flex fuel, race fuel and other setups. PSI must check your fuel system, controller support and intended use before confirming the tuning scope. Do not change fuel on Boost’s advice.', ['booking','website'], ['What details do I need for tuning?', 'I need a quote']),
    faq('ev', 'EV and hybrid', 'Do you service electric and hybrid cars?', 'Yes. Choose Service & Report in the app, then Hybrid, Plug in Hybrid or Electric. Select the relevant service options and explain the concern. PSI confirms what is supported for your model.', ['ev','booking'], ['What EV work do you do?', 'How do I book?', 'Do you rebuild EV batteries?'], ['ev']),
    faq('ev-scope', 'EV and hybrid', 'What EV work do you do?', 'The scope includes scheduled servicing, warning light diagnostics, visual and diagnostic high voltage inspections, vehicle charging faults, 12V electrical work, cooling, brakes, suspension, tyres and alignment. PSI confirms suitability for the exact vehicle.', ['ev'], ['How do I book?', 'Do you rebuild EV batteries?']),
    faq('ev-battery', 'EV and hybrid', 'Do you rebuild EV batteries?', 'Battery pack rebuilding is not part of PSI’s current EV offering. PSI can review a battery or charging concern and explain the next step for supported diagnostics or specialist repair.', ['ev'], ['What EV work do you do?', 'Message PSI']),
    faq('ev-type', 'EV and hybrid', 'Which vehicle type do I choose?', 'Choose Petrol or Diesel for a conventional vehicle. HEV means Hybrid, PHEV means Plug in Hybrid, and BEV means fully Electric. Select the type that matches your exact car, not just its brand.', ['booking'], ['How do I book?', 'What EV work do you do?']),
    faq('charging', 'EV and hybrid', 'Can you check a charging fault?', 'PSI can investigate vehicle charging concerns, including the charge port, onboard systems and supporting 12V supply. Include the model and what happens while charging. Home charger installation is not an advertised PSI service.', ['ev'], ['How do I book?', 'I need a quote']),
    faq('coding', 'Workshop', 'Do you do vehicle coding?', 'PSI offers supported coding and vehicle technology work. Compatibility depends on the exact model, year, fitted hardware and requested feature. Tell PSI the feature you want before buying credits or assuming it can be enabled.', ['coding','workshop'], ['I need a coding quote', 'Website enquiry'], ['coding']),
    faq('fitment', 'Shop', 'Will this part fit my car?', 'Send the product link or part number, vehicle year, model, engine and relevant modifications. Say whether you need supply only or supply and fitting. PSI must confirm compatibility before you order an uncertain fitment.', ['website','mail'], ['I need a parts quote', 'Website enquiry']),
    faq('stock', 'Shop', 'Is the part in stock?', 'Check the exact product and variant on the website. Boost has no live stock feed. Some items need ordering or manufacture, so PSI must confirm availability and timing before you rely on a delivery date.', ['mail','boundary'], ['Website enquiry'], ['shop']),
    faq('shipping', 'Shop', 'How much is shipping?', 'Shipping depends on the item, quantity and destination. Use the website checkout for the available options, or ask PSI about a bulky or special order. Boost cannot confirm freight or dispatch dates from an old quote.', ['website','mail'], ['Website enquiry'], ['shop']),
    faq('discount', 'Shop', 'Can you offer a discount?', 'Boost cannot issue discounts or change a quote. PSI can review the exact product or proposed work. Include the product link or your vehicle and scope in the website enquiry.', ['boundary','mail'], ['Website enquiry']),
    faq('location', 'Contact', 'Where are you?', 'PSI is at 21 Exchange Drive, Pakenham VIC 3810. Call 0433 431 781 or email info@psiperformance.com.au.', ['website'], ['What are your hours?', 'How do I book?']),
    faq('hours', 'Contact', 'What are your hours?', 'Published workshop hours are Monday to Friday, 8:30 am to 5 pm. Saturday is by appointment. Confirm holiday hours and special arrangements directly with PSI.', ['website'], ['Where are you?', 'How do I book?']),
    faq('contact', 'Contact', 'How can I contact PSI?', 'Call 0433 431 781 or email info@psiperformance.com.au. You can also send a website enquiry. Message PSI here currently opens only Matt’s local test inbox; it does not send a real message.', ['website','boundary'], ['Message PSI', 'Website enquiry'], ['enquiry']),
    faq('bot', 'About Boost', 'Are you a real person?', 'I’m Boost, PSI’s test assistant. I can explain verified information and help prepare an enquiry. I cannot inspect your car or access your account. Message PSI hands this conversation to the simulated inbox in this private preview.', ['boundary'], ['How do I book?', 'Message PSI']),
    faq('loan-car', 'Booking', 'Do you have a loan car or pickup service?', 'I do not have a confirmed loan car, pickup or towing policy to offer. Ask PSI before arranging the visit. Mention any transport or access needs with your preferred date.', ['boundary'], ['Website enquiry', 'Message PSI']),
    faq('warranty', 'Workshop', 'Will modifications affect my warranty or road compliance?', 'PSI needs to review the vehicle, proposed work and any relevant requirements. Boost cannot promise warranty coverage, road legality or engineering approval. Ask for the scope and any required checks before proceeding.', ['boundary'], ['Website enquiry', 'Message PSI']),
    faq('quote-validity', 'Quotes', 'Can I use an old quote?', 'Ask PSI to check it before ordering or booking. Parts prices, availability and the proposed scope can change. Boost cannot extend an old quote or treat another customer’s price as your quote.', ['mail','boundary'], ['I need a quote', 'Website enquiry']),
    faq('included-work', 'Quotes', 'Does that include fitting and tuning?', 'The written quote needs to list parts, fitting, tuning and any extra work separately or clearly include them in the package. PSI must confirm your exact scope before you proceed.', ['mail'], ['I need a quote', 'Website enquiry']),
    faq('own-parts', 'Quotes', 'Can I bring my own parts?', 'Ask PSI before buying or bringing them. Include the brand, part number, condition and your vehicle details so PSI can confirm whether the proposed fitting work is suitable.', ['mail','boundary'], ['Website enquiry', 'I need a parts quote']),
    faq('send-photos', 'About Boost', 'Can I send a photo here?', 'This preview accepts text only. Describe the issue or part and mention that photos are available. Do not paste sign in codes, bank details or private account documents into the test.', ['boundary'], ['Message PSI']),
    faq('message-delivery', 'About Boost', 'Does Matt receive these test messages?', 'Only in Matt’s test inbox inside this preview. Nothing is delivered to Shopify Inbox, email, SMS or the PSI app yet. Switch to Matt’s test inbox to rehearse a reply and read times.', ['boundary'], ['Message PSI']),
  ]);
  const BY_ID = Object.freeze(Object.fromEntries(FAQS.map(item => [item.id, item])));
  // Rules are intentionally explicit. Questions needing private access or safety
  // assessment are intercepted by the engine before this public FAQ layer.
  const RULES = [
    ['message-delivery', /\b(test messages|receive.*messages|send.*(?:email|sms|whatsapp|shopify inbox))\b/],
    ['send-photos', /\b(send|upload|attach)\b.*\b(photo|picture|image|file)\b/],
    ['quote-validity', /\b(old quote|previous quote|quote.*valid|honour.*quote|honor.*quote)\b/],
    ['own-parts', /\b(own parts|bring.*parts|supplied parts)\b/],
    ['included-work', /\b(include|included|includes)\b.*\b(fitting|installation|tuning|tune|labour|labor|gst)\b/],
    ['password', /\b(password|forgot.*password|reset.*password)\b/],
    ['code-help', /\b(code|codes|email)\b.*\b(arriv|arrived|not received|didnt|hasnt|not working|expired|invalid|resend|spam|junk)\b|\b(no code|missing code|resend|cant log in|cant sign in|cannot log in|cannot sign in)\b/],
    ['subscription-manage', /\b(cancel|manage|stop|renewal|renew)\b.*\b(subscription|performance plus|performance)\b|\bsubscription\b.*\b(cancel|manage|renewal)\b/],
    ['restore', /\b(restore purchases|restore performance|already paid.*performance|paid twice|subscription.*missing)\b/],
    ['trial', /\b(trial|fourteen days|14 day)\b/],
    ['plus-price', /\b(performance plus|performance|subscription)\b.*\b(price|cost|much|monthly|annual)\b|\b(price|cost|much)\b.*\b(performance|subscription)\b/],
    ['free', /\b(how much|cost|price)\b.*\b(app|download|create.*account)\b|\b(app|download)\b.*\b(cost|price)\b/],
    ['free', /\b(app|booking|bookings|account|enquir\w*)\b.*\b(free|pay|paid|subscription required)\b|\b(free app|free account|pay to book|pay for.*app|need.*performance.*book)\b/],
    ['plus', /\b(performance plus|performance membership|subscription benefits)\b|^what is performance$/],
    ['website-enquiry', /\b(website enquiry|website form|enquiry form|without (?:the )?app|dont want.*app|no app|app required|do i need (?:the )?app|have to.*app|must.*app)\b|\b(book|enquire|enquiry)\b.*\b(website|online|browser)\b/],
    ['code-help', /\b(code)\b.*\b(not|wrong|failed)\b/],
    ['signup', /\b(create|make|register|set up|setup|new)\b.*\b(account|profile)\b|\b(sign up|signup|register|account setup)\b/],
    ['signin', /\b(sign in|signin|log in|login|existing account|already have an account)\b/],
    ['garage', /\b(add|save)\b.*\b(car|vehicle)\b|\b(my garage|multiple cars|another car|second car)\b/],
    ['records-guide', /\b(where|how)\b.*\b(find|see|view|open)\b.*\b(invoice|records|photos|dyno files|history)\b/],
    ['installed', /\b(already|installed|downloaded)\b.*\b(app)\b|\b(app)\b.*\b(installed|downloaded)\b/],
    ['iphone', /^(?:i (?:use|have|am on|have an?) |im on |on |an? )?(?:apple|iphone|ios)(?: phone)?$/],
    ['android', /^(?:i (?:use|have|am on|have an?) |im on |on |an? )?(?:android|samsung|google pixel)(?: phone)?$/],
    ['iphone', /\b(iphone|ios|apple)\b.*\b(download|install|get the app)\b|\b(download|install)\b.*\b(iphone|ios|apple)\b/],
    ['android', /\b(android|samsung|google play)\b.*\b(download|install|get the app)\b|\b(download|install)\b.*\b(android|samsung|google play)\b/],
    ['download', /\b(download|install|app store|google play|get the app|need the app)\b/],
    ['booking-choice', /\b(which|what)\b.*\b(booking option|booking type|choose.*book|book.*choose)\b/],
    ['ev-type', /\b(which|what)\b.*\b(powertrain|vehicle type|hev|phev|bev)\b|\b(hev|phev|bev)\b.*\b(mean|difference)\b/],
    ['confirmed', /\b(submit|submitting|request)\b.*\b(confirm|confirmed|reserve|reserved)\b|\b(how|when)\b.*\b(booking)\b.*\b(confirmed)\b/],
    ['deposit', /\b(deposit|deposits)\b/],
    ['payment', /\b(how|can|where|do)\b.*\b(pay|payment|card|cash|bank transfer|stripe|eftpos|afterpay|payright)\b/],
    ['arrival', /\b(drop off|dropoff|after hours|before hours|keys)\b/],
    ['availability', /\b(availability|available|earliest|next appointment|next booking|slot)\b/],
    ['turnaround', /\b(how long|turnaround|same day|while i wait|car back|finish time)\b/],
    ['loan-car', /\b(loan car|courtesy car|pickup|pick up|tow|towing|transport)\b/],
    ['warranty', /\b(warranty|legal|legality|roadworthy|road compliance|engineer|engineering|certified)\b/],
    ['estimator', /\b(power estimator|estimator|stage [1234])\b/],
    ['ecu-tcu', /\b(tcu|tcm|transmission tun\w*|gearbox tun\w*)\b/],
    ['fuel', /\b(e85|flex fuel|race fuel|98 ron)\b/],
    ['power', /\b(power gain|horsepower|how much power|how many kw|fuel economy|fuel efficiency)\b/],
    ['dyno-details', /\b(need|details|prepare|preparation|setup)\b.*\b(dyno|tuning|tune)\b|\b(dyno|tuning)\b.*\b(need|details|prepare|setup)\b/],
    ['ev-battery', /\b(battery pack|ev battery|ev batteries|traction battery)\b.*\b(rebuild\w*|repair|replace)\b|\b(rebuild\w*|repair)\b.*\b(ev batter\w*|battery pack)\b/],
    ['ev-scope', /\b(ev|electric|hybrid)\b.*\b(work|include|scope|options)\b|\b(what work|what services|what checks)\b.*\b(ev|electric|hybrid)\b|\b(high voltage inspection|12v)\b/],
    ['charging', /\b(charging|charge port|home charger|charger install)\b/],
    ['coding', /\b(coding|code a feature|mbux|carplay|android auto|ambient lighting)\b/],
    ['fitment', /\b(fit my|fit this|will.*fit|compatible|compatibility|part number|supply only|own parts)\b/],
    ['stock', /\b(in stock|stock availability|availability of.*part|dispatch)\b/],
    ['shipping', /\b(shipping|freight|postage|delivery)\b/],
    ['discount', /\b(discount|coupon|promo code|cheaper|price match)\b/],
    ['plan', /\b(plan builder|plan a build|build plan|staged build)\b/],
    ['service-inclusions', /\b(include|inclusions|included)\b.*\b(plugs|filters|fluids|oil|repairs|service)\b|\b(service)\b.*\b(include|included|inclusions)\b/],
    ['logbook', /\b(logbook|log book|scheduled maintenance)\b/],
    ['diagnostics', /\b(diagnos\w*|warning light|fault|misfire|stalls|stalling|wont start|not starting)\b/],
    ['brakes', /\b(brakes|suspension|alignment|coilovers|coil overs|tyres|steering)\b/],
    ['cooling', /\b(cooling|radiator|coolant)\b/],
    ['engine-build', /\b(engine builds?|engine rebuilds?|build engines|rebuild.*engine|stroker|built motor)\b/],
    ['cam', /\b(cam|camshaft|lifters|dod|afm|trunnion)\b/],
    ['interchiller', /\b(interchiller|water meth|water methanol|heat soak)\b/],
    ['forced-induction', /\b(supercharg\w*|turbo kit|turbo upgrade|forced induction|harrop|whipple)\b/],
    ['exhaust', /\b(exhaust|headers|extractors|varex|cat back|downpipe|otr|intake)\b/],
    ['hours', /\b(hours|opening|closing|saturday|weekend|sunday|holiday)\b|\b(are you open|when.*open|when.*close|what time)\b/],
    ['contact', /\b(contact|phone number|email address|telephone)\b/],
    ['location', /\b(address|location|where are you|where is psi|pakenham)\b/],
    ['bot', /\b(real person|are you.*bot|who are you|what can you do)\b/],
  ];
  function normalise(value) {
    return value.toLowerCase().replace(/performance\s*\+/g, 'performance plus').replace(/[’']/g, '').replace(/[^a-z0-9/\s]/g, ' ').replace(/\s+/g, ' ').trim();
  }
  function isPricing(q) {
    return /\b(price|prices|cost|costs|how much|quote|estimate|ballpark|ball park|pricing)\b/.test(q) && !/\b(how much power|how much horsepower)\b/.test(q);
  }
  function match(q) {
    // Workshop price questions keep scoped quote collection. Approved category
    // starting guides do not approve specific package prices or inclusions.
    const exact = FAQS.find(item => normalise(item.question) === q);
    if (exact) return exact;
    const pricing = isPricing(q);
    for (const [id, pattern] of RULES) {
      if (pricing && !['plus-price','plus','free','deposit','payment','shipping','discount','estimator','quote-validity','included-work','ev-battery'].includes(id)) continue;
      if (pattern.test(q)) return BY_ID[id];
    }
    if (pricing) return null;
    if (/\b(book|booking|appointment|enquire|enquiry)\b/.test(q)) return BY_ID.booking;
    if (/\b(ev|electric|hybrid|hev|phev|bev|tesla|byd|polestar)\b/.test(q)) return BY_ID.ev;
    if (/\b(dyno|tuning|tune)\b/.test(q)) return BY_ID.dyno;
    if (/\b(service|servicing|maintenance|inspection)\b/.test(q)) return BY_ID.service;
    if (/^where\b/.test(q)) return BY_ID.location;
    return null;
  }
  const api = Object.freeze({ VERIFIED_ON, PRICE_GUIDES, LINKS, SOURCES, FAQS, BY_ID, normalise, isPricing, match });
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BoostKnowledge = api;
})(typeof window === 'object' ? window : globalThis);
