/* PSI Performance Website Version 5 — global Shopify enhancement */
(() => {
  const styleId = "psi-website-version-5-theme";

  if (!document.getElementById(styleId)) {
    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
:root{--psi-blue:#65cff8;--psi-deep:#155d78;--psi-silver:#dbe3e7;--psi-steel:#8f999e;--psi-charcoal:#111416;--psi-black:#050505}
html{scroll-behavior:smooth}
body,.gradient{background-color:var(--psi-black)}
.header-wrapper{border-bottom:1px solid #394247;box-shadow:0 1px 0 #65cff82e}
.header__menu-item,.header__icon,.list-menu__item{transition:color .2s ease,border-color .2s ease}
.header__menu-item:hover,.header__active-menu-item,.header__icon:hover,.list-menu__item:hover{color:var(--psi-blue)!important}
.title-wrapper-with-link,.main-page-title,.collection-hero__title{border-left:3px solid var(--psi-blue);padding-left:16px}
.button,.shopify-challenge__button,.customer button{border:1px solid var(--psi-silver);background:linear-gradient(135deg,#fff,var(--psi-silver));color:#050505;box-shadow:none}
.button:hover,.customer button:hover{border-color:var(--psi-blue);box-shadow:0 0 0 2px #65cff838}
.card,.product__media,.facets-container,.field:after,.select:after{border-color:#475157}
.card-wrapper:hover .card{box-shadow:0 0 0 1px var(--psi-blue),0 14px 34px #00000052}
.price,.price-item,.badge{color:var(--psi-blue)}
.field__input,.select__select,.customer .field input{border-color:#475157;background:var(--psi-charcoal);color:#fff}
.field__input::placeholder,.customer .field input::placeholder{color:#aab1b5;opacity:1}
.field__input:focus,.select__select:focus,.customer .field input:focus{box-shadow:0 0 0 2px #65cff840}
.pagination__item--current,.pagination__item:hover,.underlined-link:hover{color:var(--psi-blue)}
.footer{border-top:2px solid var(--psi-blue)!important;background:linear-gradient(180deg,#0b0d0e,#020202)}
.footer a:hover{color:var(--psi-blue)!important}
#psi-estimator #page-title{color:#fff!important;text-shadow:0 2px 22px rgba(0,0,0,.72)}
#psi-estimator .hero-lead{color:#d4d9dc!important}
#psi-estimator .hero-stats span{color:#aeb6bb!important}
#psi-estimator select:focus{border-color:var(--psi-blue)!important;box-shadow:0 0 0 3px rgba(101,207,248,.2)!important}
@media(max-width:749px){.title-wrapper-with-link,.main-page-title,.collection-hero__title{padding-left:12px}#psi-estimator #page-title{font-size:clamp(34px,11vw,54px)!important;line-height:1.02!important}}
`;
    document.head.appendChild(style);
  }

  function wireBookingLinks() {
    const target = window.location.pathname === "/" ? "#booking-panel" : "/#booking-panel";
    const bookingPanel = document.getElementById("booking-panel");

    if (bookingPanel) {
      bookingPanel
        .querySelectorAll('a.upgrade-item-link[href*="/products/psiperformance-gift-card"]')
        .forEach((link) => link.replaceWith(...link.childNodes));
    }

    document.querySelectorAll("a").forEach((link) => {
      const label = (link.textContent || "").trim().replace(/\s+/g, " ").toLowerCase();

      if (label === "contact") {
        link.setAttribute("href", target);
      }

      if (
        label === "book a free consultation" ||
        label === "book a free consulation" ||
        label === "book an appointment"
      ) {
        link.textContent = "Book an Appointment";
        link.setAttribute("href", target);
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wireBookingLinks, { once: true });
  } else {
    wireBookingLinks();
  }

  document.addEventListener("shopify:section:load", wireBookingLinks);
})();
