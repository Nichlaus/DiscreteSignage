# Interactive products: quick setup

This first version lets a supported Android display show a robot or cat invitation,
introduce up to three products and offer a short trivia round while adverts play.
It uses approved product details and curated questions. It is not an open-ended
voice assistant. Camera-based greetings remain a developer preview until physical
device testing is complete.

## Set up your screen

1. Pair the Android display with your business and location. Save a playlist and
   confirm that an advert is visible on the actual screen.
2. In **Featured product for interactive AI**, choose the same location and select
   **Open featured product**.
3. Choose a product slot. Enter its name, short description and AUD price. Select
   **Available to feature**, check the approval box and save. Repeat for up to three
   products. Save each slot separately.
4. Open the screen's settings. Set **Interactive product overlay** to **On · approved
   featured product**, choose the robot or cat, then **Save screen settings**.
5. On the display, select **Explore a featured product**. Check its wording and price.
   With multiple available products, use **Next product**. Try the trivia button and
   **No thanks / close**. Normal adverts continue underneath.

Your business needs active signage access and Interactive AI access. The fourteen-day
trial includes eligible features without a payment method. Separate paid pricing is
not configured yet; an administrator manages interactive access for now.

## Change or stop a promotion

Edit and approve the product again to publish updated details. Mark a product
**Unavailable — do not promote** to remove it from interactions. To stop all
interactions on one screen, switch its overlay off and save. These actions do not
remove its advert playlist. Check the actual display after changing settings.

Products are refreshed online approximately every twenty seconds. Interaction
authorisation lasts at most sixty seconds and may end sooner. If access expires or
cannot be renewed, the product/trivia overlay closes. Downloaded advertising follows
its separate authorisation, including the configured maximum of twenty-four hours
offline; interactive offers are not authorised for that entire offline period.

## Administrator access

At `/admin.html`, sign in with MFA, select the business and find **Interactive AI
access**. An authorised administrator can choose **Use trial access**, **Enable until
expiry** (up to ninety days), or **Disable**. Enter a reason and save. Expiry is entered
in the browser's local time zone. Every change is audited. Interactive activation
does not extend signage access, charge the business or grant camera permission.

## Camera preview and help

The production camera feature is not released yet. During an authorised developer
test, camera selection and permission are local to the Android device, and the
operator must explicitly start capture. Portal activation never opens a camera.
Physical camera compatibility, positioning, lighting and gesture accuracy remain
untested. Do not advertise automatic customer detection as production-ready.

If no invitation appears, confirm that an advert is actually playing, the overlay
is on, at least one product at that location is available, the business has active
signage and interactive access, and the screen is online. A saved setting or an
Applied status is not proof that customers can see the display. If details are out
of date, allow a refresh interval and check the correct location and product slot.
Contact the platform administrator if access or expiry needs checking.
