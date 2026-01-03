
/*Resource class defines addresses of the resources internally, and stores them in images object, later on we'll make an 'add'function
here which stores the resource info in toLoad and adds it to images as well. We'll use that function to integrate addition 
of resources that would be fetched from the db by hitting the http server in a separate module */


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

    this.images = {}; //an object containing {html image element , boolean representing readiness} next to the resource name as key

    //iterates over every toLoad object, and creates an htmlimage element for it, triggers the boolean when its ready to be used
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
