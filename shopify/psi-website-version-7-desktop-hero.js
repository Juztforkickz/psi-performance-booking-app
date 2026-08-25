/* PSI Performance Website Version 9 — balanced desktop hero cards with clear vehicle sightlines */
(() => {
  const styleId = "psi-website-version-9-desktop-hero";

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
    border:1px solid rgba(101,206,248,.55)!important;
    border-left:4px solid #65cef8!important;
    box-shadow:0 16px 50px rgba(0,0,0,.30), 0 0 24px rgba(101,206,248,.12)!important;
    margin-left:0!important;
    margin-top:-0.4rem!important;
    box-sizing:border-box!important;
    overflow:visible!important;
  }
  .slideshow .banner__buttons .button{
    border-color:#65cef8!important;
    box-shadow:inset 0 -3px 0 #65cef8!important;
  }
  .slideshow .banner__heading{
    max-width:100%!important;
    overflow:visible!important;
  }
  #Slide-template--16238529609857__slideshow_aNgmgx-1 .slideshow__text.banner__box{
    width:36rem!important;
    min-width:36rem!important;
    max-width:36rem!important;
    padding:3rem 2.6rem!important;
    margin-left:-1.2rem!important;
  }
  #Slide-template--16238529609857__slideshow_aNgmgx-1 .banner__heading{
    font-size:2.8rem!important;
    line-height:1.12!important;
  }
  #Slide-template--16238529609857__slideshow_aNgmgx-3 .slideshow__text.banner__box{
    width:49rem!important;
    min-width:49rem!important;
    max-width:49rem!important;
    height:37rem!important;
    min-height:37rem!important;
    padding-top:2.8rem!important;
    padding-bottom:2.8rem!important;
  }
  #Slide-template--16238529609857__slideshow_aNgmgx-3 .banner__text{
    font-size:1.6rem!important;
    line-height:1.35!important;
  }
}
`;
  document.head.appendChild(style);
})();
