/* PSI Performance Website Version 6 — visibility, footer and homepage polish */
(() => {
  const styleId = "psi-website-version-6-theme";
  const servicedBrands = [
    "Audi",
    "BMW",
    "Ford",
    "Holden",
    "Lamborghini",
    "Mercedes-Benz",
    "Porsche",
    "Škoda",
    "Volkswagen",
  ];

  if (!document.getElementById(styleId)) {
    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
body.gradient{--color-foreground:244,247,248;--color-background:5,5,5;--gradient-background:#050505;background:#050505!important;color:rgba(244,247,248,.88)}
body .gradient{background:var(--gradient-background)!important}
main .color-scheme-1.gradient,main .color-background-1.gradient{--color-foreground:244,247,248;--color-background:5,5,5;--gradient-background:#050505;color:rgba(244,247,248,.88)}
main .main-page-title,main .collection-hero__title,main .product__title h1,main .rich-text__heading,main .rte h1,main .rte h2,main .rte h3,main .rte h4,main .card__heading,main .card__heading a{color:#f7f9fa!important}
main .rte,main .rte p,main .rte li,main .rte strong,main .collection-hero__description,main .product__description,main .text-body,main .facets__heading,main .facet-filters__label,main .product-count__text,main .mobile-facets__heading,main .mobile-facets__count,main .mobile-facets__info{color:#d5dce0!important}
main .main-page-title,main .collection-hero__title{text-shadow:0 2px 22px rgba(0,0,0,.72)}
.why-choose-us-section,.services-carousel-section,.custom-review-section{background:radial-gradient(circle at 50% 0,rgba(101,207,248,.11),transparent 42%),#000!important;border-top:1px solid rgba(101,207,248,.28);border-bottom:1px solid rgba(101,207,248,.14)}
.why-choose-us-heading,.services-heading,.review-heading{text-shadow:0 0 28px rgba(101,207,248,.22)}
.why-choose-us-heading::after,.services-heading::after,.review-heading::after{content:"";display:block;width:72px;height:3px;margin:15px auto 0;background:linear-gradient(90deg,transparent,#65cff8,transparent);box-shadow:0 0 14px rgba(101,207,248,.55)}
.feature-icon img{filter:drop-shadow(0 0 8px rgba(101,207,248,.28))}
.service-item{border:1px solid rgba(101,207,248,.25);box-shadow:inset 0 0 0 1px rgba(219,227,231,.04)}
.review-item{border:1px solid rgba(101,207,248,.32);box-shadow:inset 0 3px 0 rgba(101,207,248,.7),0 18px 38px rgba(0,0,0,.26)}
.star.filled{color:#65cff8!important;text-shadow:0 0 10px rgba(101,207,248,.42)}
.services-carousel-dot.active,.review-carousel-dot.active{background-color:#65cff8!important;box-shadow:0 0 10px rgba(101,207,248,.55)}
.services-carousel-control:hover,.review-carousel-control:hover{color:#65cff8!important}
.brand-marquee{border-top:1px solid rgba(101,207,248,.24);border-bottom:1px solid rgba(101,207,248,.24)}
.brand-marquee__content{--marquee-duration:22s!important;animation-duration:22s!important}
.brand-marquee__logo{filter:grayscale(1) brightness(1.32) contrast(1.08) drop-shadow(0 0 7px rgba(101,207,248,.18))}
.psi-v6-brand-grid{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr));gap:3px 14px;margin-top:0!important}
.psi-v6-brand-grid li{margin:0!important;padding:0!important}
.psi-v6-brand-grid span{display:block;padding:3px 0;color:rgba(219,227,231,.82);font-size:1.35rem;line-height:1.45}
.footer-block__details-content a{color:rgba(219,227,231,.88)!important}
.footer-block__details-content a:hover{color:#65cff8!important}
@media(max-width:749px){main .main-page-title,main .collection-hero__title{color:#fff!important}.why-choose-us-section,.services-carousel-section,.custom-review-section{background:radial-gradient(circle at 50% 0,rgba(101,207,248,.09),transparent 34%),#000!important}.psi-v6-brand-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
`;
    document.head.appendChild(style);
  }

  function unwrapInheritedGiftCardLinks() {
    const selectors = [
      '.custom-review-section-wrapper > a.upgrade-item-link[href*="psiperformance-gift-card"]',
      '#booking-panel a.upgrade-item-link[href*="psiperformance-gift-card"]',
    ];

    document.querySelectorAll(selectors.join(",")).forEach((link) => {
      link.replaceWith(...link.childNodes);
    });

    document.querySelectorAll(".brand-marquee").forEach((marquee) => {
      const section = marquee.closest(".shopify-section");
      const link = section?.querySelector(
        ':scope > a.upgrade-item-link[href*="psiperformance-gift-card"]',
      );
      if (link) link.replaceWith(...link.childNodes);
    });
  }

  function polishFooter() {
    const footer = document.querySelector("footer");
    if (!footer) return;

    const blocks = [...footer.querySelectorAll(".footer-block--menu")];
    const findBlock = (heading) =>
      blocks.find(
        (block) =>
          (block.querySelector(".footer-block__heading")?.textContent || "")
            .trim()
            .toLowerCase() === heading,
      );
    const brandsBlock = findBlock("brands we service");
    const servicesBlock = findBlock("services");
    const brandsList = brandsBlock?.querySelector("ul");
    const servicesList = servicesBlock?.querySelector("ul");

    if (!brandsList || !servicesList) return;

    const tuningLink = [...brandsList.querySelectorAll("a")].find(
      (link) => (link.textContent || "").trim().toLowerCase() === "tuning",
    );

    if (tuningLink) {
      tuningLink.href = "/pages/power-estimator";
      servicesList.appendChild(tuningLink.closest("li"));
    }

    if (!brandsList.classList.contains("psi-v6-brand-grid")) {
      brandsList.replaceChildren(
        ...servicedBrands.map((brand) => {
          const item = document.createElement("li");
          const label = document.createElement("span");
          label.textContent = brand;
          item.appendChild(label);
          return item;
        }),
      );
      brandsList.classList.add("psi-v6-brand-grid");
    }
  }

  function polishHomepageCopy() {
    const reviewSubheading = document.querySelector(".review-subheading");
    if (reviewSubheading && /lorem ipsum/i.test(reviewSubheading.textContent || "")) {
      reviewSubheading.textContent =
        "Real feedback from customers who trusted PSI with their vehicles.";
    }
  }

  function applyVersionSix() {
    unwrapInheritedGiftCardLinks();
    polishFooter();
    polishHomepageCopy();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", applyVersionSix, { once: true });
  } else {
    applyVersionSix();
  }

  document.addEventListener("shopify:section:load", applyVersionSix);
})();
