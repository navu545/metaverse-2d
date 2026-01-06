import { events } from "../../core/Events";
import { GameObject } from "../../core/GameObject";
import { resources } from "../../core/Resource";
import { Sprite } from "../../core/Sprite";
import { Vector2 } from "../../core/Vector2";

//this class stores picked up items and saves them in inventory and display on the upper left HUD
export class Inventory extends GameObject {
  nextId: number;
  items: {
    id: number;
    image: { image: HTMLImageElement; isLoaded: boolean };
  }[];
  constructor() {
    super(new Vector2(0, 1));
    this.nextId = 0;
    //default items
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
    //on detection of rod being picked, run renderInventory which adds a new sprite to inventory HUD
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

  //adds a new rod child to the HUD
  renderInventory() {
    this.children.forEach((child) => child.destroy()); //clear out the old sprites first and then render the list from start to avoid stale sprites

    this.items.forEach((item, index: number) => {
      const sprite = new Sprite({
        resource: item.image,
        position: new Vector2(index * 12, 0),
      });
      this.addChild(sprite);
    });
  }

  //to remove a specific spent item from the inventory
  removeFromInventory(id: number) {
    this.items = this.items.filter((item) => item.id !== id);
    this.renderInventory();
  }
}
