/* PSI Performance Website Version 7 — restore desktop slideshow card spacing */
(() => {
  const styleId = "psi-website-version-7-desktop-hero";

  if (document.getElementById(styleId)) return;

  const style = document.createElement("style");
  style.id = styleId;
  style.textContent = `
@media(min-width:750px){
  .slideshow .slideshow__text.banner__box{
    width:100%!important;
    min-width:45rem!important;
    max-width:54.5rem!important;
    padding:4rem 3.5rem!important;
    box-sizing:border-box!important;
    overflow:visible!important;
  }
  .slideshow .banner__heading{
    max-width:100%!important;
    overflow:visible!important;
  }
}
`;
  document.head.appendChild(style);
})();
