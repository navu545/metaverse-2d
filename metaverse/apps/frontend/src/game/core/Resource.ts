class Resources {

    toLoad: Record<string, string>
    images: Record<string, {image:HTMLImageElement, isLoaded:boolean}>

  constructor() {
    this.toLoad = {
      sky: "/sprites/sky.png",
      ground: "/sprites/ground.png",
      hero: "/sprites/hero-sheet.png",
      shadow: "/sprites/shadow.png",
      rod: "/sprites/rod.png",
      message: "/sprites/mail.png",
      accept: "./sprites/accept.png",
      decline: "./sprites/decline.png",
      loading: "./sprites/buffer.png"

    };

    this.images = {};

    Object.keys(this.toLoad).forEach((key) => {
      const img = new Image();
      img.src = this.toLoad[key];
      this.images[key] = {
        image: img,
        isLoaded: false,
      };
      img.onload = () => {
        this.images[key].isLoaded = true;
      };
    });

  }
}

export const resources = new Resources();
