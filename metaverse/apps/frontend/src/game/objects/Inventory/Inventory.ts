import { events } from "../../core/Events";
import { GameObject } from "../../core/GameObject";
import { resources } from "../../core/Resource";
import { Sprite } from "../../core/Sprite";
import { Vector2 } from "../../core/Vector2";

export class Inventory extends GameObject {
  nextId: number;
  items: { id: number; image: { image: HTMLImageElement; isLoaded: boolean }}[];
  constructor() {
    super(new Vector2(0, 1));
    this.nextId = 0;
    this.items = [
      {
        id: -1,
        image: resources.images.rod,
      },
      {
        id: -2,
        image: resources.images.rod,
      },
    ];

    events.on("HERO_PICKS_UP_ITEM", this, () => {
      this.nextId += 1;

      this.items.push({
        id: this.nextId,
        image: resources.images.rod,
      });

      this.renderInventory();
    });
    this.renderInventory();
  }

  renderInventory() {
    this.children.forEach((child) => child.destroy());


    this.items.forEach((item, index: number) => {
      const sprite = new Sprite({
        resource: item.image,
        position: new Vector2(index * 12, 0),
      });
      this.addChild(sprite);
    });

  }

  removeFromInventory(id: number) {
    this.items = this.items.filter((item) => item.id !== id);
    this.renderInventory();
  }
}
