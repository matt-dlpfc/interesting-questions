// New invite codes look like "tiger-ferry-lamp-42": three words and a number (D17).
// About 400 words → 400³ × 90 ≈ 6 × 10⁹ codes: with the login slowdown, far beyond guessing range.

import { randomInt } from 'node:crypto';

const WORDS = [
  ...new Set(
    `
acorn actor agent alarm album alley amber angle ankle apple apron arch arena arrow atlas attic autumn
badge bagel baker bamboo banjo barn basil basket beach beacon beard beetle bell bench berry bicycle
birch biscuit bison blanket blaze blossom boat bonnet bottle boulder bowl branch brass bread breeze
brick bridge brook broom bubble bucket buckle bugle bunny butter button cabin cactus cake camel camera
candle canoe canyon cape carpet carrot castle cedar cellar cello chalk channel chapel cherry chess
chimney cider cinema circus citrus clam clay cliff clock cloud clover coast cobalt cocoa coconut comet
compass copper coral cotton cougar cousin coyote crab crane crater crayon creek cricket crown crystal
cup curtain cushion cycle daisy dancer dawn deer delta desert diamond diary dinner dolphin donkey door
dragon drawer dream drum duck dune eagle easel echo eclipse elbow elder ember engine fable falcon fern
ferry fiddle field fig finch fjord flame flannel flute fog forest fossil fountain fox frost galaxy
garden garlic gecko geyser ginger glacier globe glove goat goose grape gravel guitar gull hammer
harbor harp hazel heron hill honey hoop horizon hornet house husky igloo inkwell island ivory ivy
jacket jaguar jam jasmine jelly jewel journal jungle kayak kettle kiosk kite kitten koala ladder
lagoon lake lamp lantern lark laurel lava leaf lemon lentil lily lime linen lion lizard llama lobster
locket lotus lunar lynx magnet mango maple marble market meadow melon mesa meteor mint mirror mitten
mole monk moon moose mosaic moss moth mountain muffin mural nectar needle nest nickel noodle north
nutmeg oak oasis ocean olive onion opal orange orbit orchard orchid otter owl oyster paddle palace
panda paper parade parcel parrot pasta peach peanut pear pebble pelican pepper piano pickle pigeon
pillow pine pirate planet plum pocket poem polar pond poppy porch potato prairie prism puffin pumpkin
puzzle quail quarry quartz quill rabbit radar radish rain raven reef ribbon river robin rocket rose
ruby saddle saffron sage sail salmon sand satchel scarf school scooter sea seal seed shadow shell
shore silver sketch sky sled sloth snail snow sofa sonnet sparrow spice spider spoon spruce squid
star stone stork storm stream sugar summit sun swan sweater tango teapot temple thistle thunder tiger
timber toast tomato topaz torch tower trail train tulip tundra turtle tuxedo umbrella valley velvet
violet violin volcano voyage wagon walnut walrus wave whale wheat whistle willow window winter wolf
wombat wren yacht yarn yeti yogurt zebra zephyr zinnia
`
      .trim()
      .split(/\s+/),
  ),
];

export function generateCode(): string {
  const word = () => WORDS[randomInt(WORDS.length)];
  return `${word()}-${word()}-${word()}-${randomInt(10, 100)}`;
}
