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
  .slideshow .banner__heading .psi-v9-heading-line{
    display:block!important;
    white-space:nowrap!important;
  }
  #Slide-template--16238529609857__slideshow_aNgmgx-1 .slideshow__text.banner__box{
    width:78rem!important;
    min-width:78rem!important;
    max-width:78rem!important;
    min-height:29rem!important;
    padding:2.2rem 2.8rem 2rem 2.2rem!important;
    margin-left:0!important;
    margin-top:-6rem!important;
  }
  #Slide-template--16238529609857__slideshow_aNgmgx-1 .banner__heading{
    font-size:4rem!important;
    line-height:1.12!important;
    transform:translateX(-0.25rem)!important;
  }
  #Slide-template--16238529609857__slideshow_aNgmgx-1 .banner__text{
    transform:translateY(-0.4rem)!important;
  }
  #Slide-template--16238529609857__slideshow_aNgmgx-1 .banner__buttons{
    transform:translateY(-0.6rem)!important;
  }
  #Slide-template--16238529609857__slideshow_aNgmgx-3 .slideshow__text.banner__box{
    width:55rem!important;
    min-width:55rem!important;
    max-width:55rem!important;
    height:37rem!important;
    min-height:37rem!important;
    padding-top:2.8rem!important;
    padding-bottom:2.8rem!important;
  }
  #Slide-template--16238529609857__slideshow_aNgmgx-3 .banner__text{
    font-size:1.6rem!important;
    line-height:1.35!important;
  }
  #Slide-template--16238529609857__slideshow_aNgmgx-3 .banner__heading{
    font-size:4rem!important;
    line-height:1.12!important;
  }
}
`;
  document.head.appendChild(style);

  const headingLines = [
    {
      selector: "#Slide-template--16238529609857__slideshow_aNgmgx-1 .banner__heading",
      lines: ["Performance Services,", "Maintenance & Repairs"],
    },
    {
      selector: "#Slide-template--16238529609857__slideshow_aNgmgx-3 .banner__heading",
      lines: ["Performance", "Tuning & Coding"],
    },
  ];

  const formatHeadings = () => {
    headingLines.forEach(({ selector, lines }) => {
      const heading = document.querySelector(selector);
      if (!heading || heading.dataset.psiV9Formatted === "true") return;

      const content = [];
      lines.forEach((line, index) => {
        const span = document.createElement("span");
        span.className = "psi-v9-heading-line";
        span.textContent = line;
        content.push(span);
        if (index < lines.length - 1) content.push(document.createTextNode(" "));
      });

      heading.replaceChildren(...content);
      heading.dataset.psiV9Formatted = "true";
    });
  };

  formatHeadings();
  document.addEventListener("shopify:section:load", formatHeadings);
})();
