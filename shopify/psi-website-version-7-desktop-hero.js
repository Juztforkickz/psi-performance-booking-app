/* PSI Performance Website Version 8 — desktop hero card tuned for less visual crowding on vehicles */
(() => {
  const styleId = "psi-website-version-8-desktop-hero";

  if (document.getElementById(styleId)) return;

  const style = document.createElement("style");
  style.id = styleId;
  style.textContent = `
@media(min-width:750px){
  .slideshow .slideshow__text.banner__box{
    background: rgba(0,0,0,.58)!important;
    backdrop-filter: blur(8px)!important;
    -webkit-backdrop-filter: blur(8px)!important;
    width:100%!important;
    min-width:42rem!important;
    max-width:52rem!important;
    padding:3.4rem 3rem!important;
    border:1px solid rgba(101,206,248,0.22)!important;
    box-shadow:0 16px 50px rgba(0,0,0,.30), inset 3px 0 0 rgba(101,206,248,0.62)!important;
    margin-left:0!important;
    margin-top:-0.4rem!important;
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
