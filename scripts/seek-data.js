// 🔍 Seek & Find — ALL content for the look-and-find world: the things that
// can be in a picture, the places, and every line the world says. The engine
// (seek-logic.js) lays a place out from this; nothing here runs. Dual export,
// so the node tests read exactly what the page reads.
//
// The genre (a big busy picture and a list of things to spot in it) is old and
// generic; nothing here borrows a book's character, look or name. The one who
// hides in every picture is JOSH'S OWN BUDDY (JoshBuddy), so the hidden friend
// is the one he picked.
//
// The pictures are Google's Noto emoji art (Apache License 2.0, see
// NOTO-LICENSE.txt), drawn as images from scripts/seek-art.js — NOT as text, so
// they look the same on every device and none is ever an empty box on his
// iPad. `art` names a picture in that file; a person's picture is its base
// name, and the layout adds one of TONES (so a crowd has every skin colour).

(function (global) {
  "use strict";

  // The world's width, in layout units. Every place is this wide and as tall
  // as it says; the screen scales the whole picture to its width, so a place
  // is the SAME picture on every device and only scrolls further on a phone.
  const W = 540;

  // Skin tones a person can wear (Noto's own names for them).
  const TONES = ["light", "medium", "dark"];

  // ---- Every kind of thing a picture can hold ------------------------------
  // art   the picture's name in seek-art.js
  // say   what the voice calls ONE of them ("Find the duck!")
  // many  what it calls several ("Find 3 ducks!"); only kinds that can be COUNTED
  // size  how big it is drawn, in layout units (a ladybug is small, a tree big)
  // group things a child would call by the same name; a picture that asks for
  //       one never holds another of its group (default: the kind itself)
  // tone  a person: the layout picks a skin tone
  // prop  big scenery: never asked for, may hide the buddy, never covers a find
  // sky   floats: no shadow under it
  const K = (art, say, size, more) => Object.assign({ art, say, size }, more || {});
  const KINDS = {
    // in the air
    balloon: K("balloon", "balloon", 78, { many: "balloons", sky: true }),
    kite: K("kite", "kite", 92, { sky: true }),
    bird: K("bird", "bird", 74, { many: "birds", sky: true }),
    butterfly: K("butterfly", "butterfly", 70, { many: "butterflies", sky: true }),
    airplane: K("airplane", "airplane", 104, { sky: true }),
    helicopter: K("helicopter", "helicopter", 100, { sky: true }),
    cloud: K("cloud", "cloud", 120, { sky: true }),
    sun: K("sun-with-face", "sun", 130, { sky: true, prop: true }),
    honeybee: K("honeybee", "bee", 62, { many: "bees" }),
    // trees and big scenery
    tree: K("deciduous-tree", "tree", 190, { prop: true }),
    pine: K("evergreen-tree", "pine tree", 190, { prop: true }),
    palm: K("palm-tree", "palm tree", 200, { prop: true }),
    cactus: K("cactus", "cactus", 130, { prop: true }),
    umbrella: K("umbrella-on-ground", "beach umbrella", 170, { prop: true }),
    hut: K("hut", "hut", 190, { prop: true }),
    house: K("house", "house", 200, { prop: true }),
    office: K("office-building", "office building", 210, { prop: true }),
    store: K("convenience-store", "shop", 200, { prop: true }),
    hospital: K("hospital", "hospital", 210, { prop: true }),
    school: K("school", "school", 210, { prop: true }),
    postoffice: K("post-office", "post office", 200, { prop: true }),
    fountain: K("fountain", "fountain", 170, { prop: true }),
    rock: K("rock", "rock", 110, { prop: true }),
    // little animals
    duck: K("duck", "duck", 84, { many: "ducks" }),
    swan: K("swan", "swan", 96),
    frog: K("frog", "frog", 74, { many: "frogs" }),
    turtle: K("turtle", "turtle", 84, { many: "turtles" }),
    fish: K("tropical-fish", "fish", 76, { many: "fish" }),
    owl: K("owl", "owl", 80),
    chipmunk: K("chipmunk", "chipmunk", 76),
    hedgehog: K("hedgehog", "hedgehog", 74),
    rabbit: K("rabbit", "bunny", 80, { many: "bunnies" }),
    mouse: K("mouse", "mouse", 66, { many: "mice" }),
    snail: K("snail", "snail", 64, { many: "snails" }),
    ladybug: K("lady-beetle", "ladybug", 60, { many: "ladybugs" }),
    caterpillar: K("bug", "caterpillar", 66),
    dog: K("dog", "dog", 96),
    cat: K("cat", "cat", 90),
    crab: K("crab", "crab", 74, { many: "crabs" }),
    shell: K("spiral-shell", "shell", 62, { many: "shells" }),
    octopus: K("octopus", "octopus", 90),
    dolphin: K("dolphin", "dolphin", 104),
    whale: K("spouting-whale", "whale", 130),
    shark: K("shark", "shark", 120),
    // farm animals
    cow: K("cow", "cow", 120, { many: "cows" }),
    pig: K("pig", "pig", 104, { many: "pigs" }),
    sheep: K("ewe", "sheep", 104, { many: "sheep" }),
    goat: K("goat", "goat", 100),
    horse: K("horse", "horse", 124),
    chicken: K("chicken", "chicken", 82, { many: "chickens", group: "chicken" }),
    rooster: K("rooster", "rooster", 88, { group: "chicken" }),
    chick: K("hatching-chick", "chick", 66, { many: "chicks" }),
    // zoo animals
    lion: K("lion", "lion", 118),
    tiger: K("tiger", "tiger", 118),
    elephant: K("elephant", "elephant", 150),
    giraffe: K("giraffe", "giraffe", 150, { many: "giraffes" }),
    zebra: K("zebra", "zebra", 124, { many: "zebras" }),
    rhino: K("rhinoceros", "rhino", 138),
    camel: K("two-hump-camel", "camel", 134),
    monkey: K("monkey", "monkey", 96, { many: "monkeys" }),
    gorilla: K("gorilla", "gorilla", 120),
    parrot: K("parrot", "parrot", 84, { many: "parrots" }),
    peacock: K("peacock", "peacock", 120),
    snake: K("snake", "snake", 100),
    sloth: K("sloth", "sloth", 96),
    hippo: K("hippopotamus", "hippo", 138),
    crocodile: K("crocodile", "crocodile", 138),
    flamingo: K("flamingo", "flamingo", 104, { many: "flamingos" }),
    penguin: K("penguin", "penguin", 90, { many: "penguins" }),
    polarbear: K("polar-bear", "polar bear", 130),
    seal: K("seal", "seal", 110),
    // flowers and food
    tulip: K("tulip", "tulip", 70, { many: "tulips" }),
    sunflower: K("sunflower", "sunflower", 96, { many: "sunflowers" }),
    hibiscus: K("hibiscus", "pink flower", 72),
    rose: K("rose", "rose", 70),
    mushroom: K("mushroom", "mushroom", 66, { many: "mushrooms" }),
    corn: K("ear-of-corn", "corn", 80, { many: "corn cobs" }),
    carrot: K("carrot", "carrot", 72, { many: "carrots" }),
    watermelon: K("watermelon", "watermelon", 82),
    coconut: K("coconut", "coconut", 72),
    icecream: K("soft-ice-cream", "ice cream", 76),
    shavedice: K("shaved-ice", "snow cone", 78),
    // toys and things
    ball: K("soccer-ball", "soccer ball", 72, { many: "soccer balls" }),
    volleyball: K("volleyball", "beach ball", 74),
    teddy: K("teddy-bear", "teddy bear", 84),
    scooter: K("kick-scooter", "scooter", 92),
    sunglasses: K("sunglasses", "sunglasses", 70),
    sandal: K("thong-sandal", "flip-flop", 66),
    bucket: K("bucket", "bucket", 72, { many: "buckets" }),
    postbox: K("postbox", "mailbox", 90),
    trafficlight: K("vertical-traffic-light", "traffic light", 110, { prop: true }),
    sign: K("construction", "road sign", 92),
    telescope: K("telescope", "telescope", 100),
    // things that go
    car: K("automobile", "car", 124, { many: "cars" }),
    taxi: K("taxi", "taxi", 124, { many: "taxis" }),
    bus: K("bus", "bus", 150),
    policecar: K("police-car", "police car", 124),
    fireengine: K("fire-engine", "fire engine", 150),
    ambulance: K("ambulance", "ambulance", 140),
    truck: K("delivery-truck", "truck", 140),
    motorscooter: K("motor-scooter", "motorbike", 110),
    tractor: K("tractor", "tractor", 140),
    sailboat: K("sailboat", "sailboat", 120, { many: "sailboats" }),
    speedboat: K("speedboat", "speedboat", 120),
    // space
    planet: K("ringed-planet", "planet", 130, { sky: true }),
    comet: K("comet", "comet", 100, { sky: true }),
    star: K("star", "star", 62, { many: "stars", sky: true }),
    moon: K("crescent-moon", "moon", 100, { sky: true }),
    satellite: K("satellite", "satellite", 110, { sky: true }),
    ufo: K("flying-saucer", "flying saucer", 120, { sky: true }),
    rocket: K("rocket", "rocket", 130),
    alien: K("alien", "alien", 84, { many: "aliens" }),
    monster: K("alien-monster", "space monster", 84),
    robot: K("robot", "robot", 92),
    // people (the layout picks a skin tone for each)
    biker: K("person-biking", "person on a bike", 118, { tone: true }),
    runner: K("person-running", "runner", 104, { tone: true }),
    walker: K("person-walking", "person walking", 104, { tone: true }),
    stander: K("person-standing", "person standing", 104, { tone: true }),
    friends: K("people-holding-hands", "friends holding hands", 116, { tone: true }),
    wheelchair: K("person-in-manual-wheelchair", "person in a wheelchair", 112, { tone: true }),
    cartwheel: K("person-cartwheeling", "cartwheel kid", 104, { tone: true }),
    juggler: K("person-juggling", "juggler", 110, { tone: true }),
    swimmer: K("person-swimming", "swimmer", 110, { tone: true }),
    surfer: K("person-surfing", "surfer", 120, { tone: true }),
    rower: K("person-rowing-boat", "rowing boat", 124, { tone: true }),
    cook: K("cook", "cook", 104, { tone: true }),
    firefighter: K("firefighter", "firefighter", 104, { tone: true }),
    police: K("police-officer", "police officer", 104, { tone: true }),
    builder: K("construction-worker", "builder", 104, { tone: true }),
    doctor: K("health-worker", "doctor", 104, { tone: true }),
    teacher: K("teacher", "teacher", 104, { tone: true }),
    farmer: K("farmer", "farmer", 104, { tone: true }),
    astronaut: K("astronaut", "astronaut", 108, { tone: true, many: "astronauts" }),
    artist: K("artist", "painter", 104, { tone: true }),
  };

  // ---- The places ----------------------------------------------------------
  // h      how tall the picture is, in layout units
  // door   the picture on its door (a KINDS id)
  // ground the floor of the picture: shapes drawn behind everything —
  //        ["rect", x, y, w, h, fill] · ["ellipse", cx, cy, rx, ry, fill] ·
  //        ["path", d, stroke, width] (a band: a road, a winding path)
  // marks  little ground marks scattered over a rect, drawn per place from its
  //        seed: ["tufts"|"waves"|"dots"|"stars"|"craters"|"stripes", x, y, w, h, colour, n]
  // zones  where things stand: rect [x, y, w, h] (oval: true keeps them inside
  //        the oval), n fillers, and the kinds (with weights) that live there.
  //        A zone's `props` are big scenery laid first, in a loose row.
  // hide   the props the buddy may peek out from behind
  // finds  the kinds the list may ask for: one of each, or (`count`) several
  const PLACES = [
    {
      id: "park", name: "Busy Park", door: "tree", h: 2300, sky: "#bfe6ff",
      ground: [
        ["rect", 0, 0, 540, 430, "#c4e8ff"],
        ["ellipse", 120, 430, 260, 70, "#a8dc84"],
        ["ellipse", 430, 440, 240, 80, "#9cd47a"],
        ["rect", 0, 430, 540, 1870, "#92d070"],
        ["ellipse", 270, 1000, 236, 176, "#5fb6e4"],
        ["ellipse", 270, 1000, 222, 162, "#79c8f0"],
        ["path", "M -20 1260 C 140 1330 380 1220 560 1330", "#ead7a6", 56],
        ["path", "M 270 1180 C 230 1500 330 1600 250 1800", "#ead7a6", 46],
        ["rect", 0, 1830, 540, 470, "#7fc45e"],
      ],
      marks: [["tufts", 0, 440, 540, 1860, "#6fb84d", 90], ["waves", 70, 880, 400, 240, "#ffffff", 14]],
      zones: [
        { id: "sky", rect: [0, 30, 540, 370], n: 8, kinds: { balloon: 3, kite: 2, bird: 3, butterfly: 2, airplane: 1, cloud: 2 }, fixed: ["sun"] },
        { id: "trees", rect: [0, 420, 540, 360], n: 7, props: ["tree", "pine", "tree", "pine", "tree"], kinds: { owl: 2, chipmunk: 2, bird: 2, butterfly: 1, honeybee: 1 } },
        { id: "pond", rect: [60, 860, 420, 280], oval: true, n: 10, kinds: { duck: 3, swan: 2, frog: 2, turtle: 2, fish: 2, rower: 1 } },
        { id: "meadow", rect: [0, 1190, 540, 630], n: 18, kinds: { dog: 2, cat: 2, rabbit: 2, ball: 2, teddy: 1, icecream: 2, biker: 2, runner: 2, stander: 2, cartwheel: 1, juggler: 1, scooter: 1, hedgehog: 1, kite: 1 } },
        { id: "flowers", rect: [0, 1850, 540, 430], n: 18, kinds: { tulip: 4, sunflower: 2, hibiscus: 2, rose: 2, mushroom: 2, ladybug: 2, honeybee: 2, snail: 2, butterfly: 2, caterpillar: 1 } },
      ],
      hide: ["tree", "pine"],
      finds: { owl: 1, chipmunk: 1, swan: 1, turtle: 1, frog: 1, dog: 1, cat: 1, teddy: 1, icecream: 1, biker: 1, juggler: 1, cartwheel: 1, scooter: 1, hedgehog: 1, kite: 1, airplane: 1, snail: 1, mushroom: 1, caterpillar: 1, rose: 1,
        balloon: "count", duck: "count", ladybug: "count", tulip: "count", butterfly: "count" },
    },
    {
      id: "beach", name: "Beach Day", door: "umbrella", h: 2300, sky: "#bfe6ff",
      ground: [
        ["rect", 0, 0, 540, 400, "#c8ebff"],
        ["rect", 0, 400, 540, 720, "#3fa9e0"],
        ["rect", 0, 400, 540, 140, "#2f97d2"],
        ["path", "M -20 1120 C 120 1090 260 1150 380 1110 C 460 1086 520 1100 560 1110", "#e9f8ff", 34],
        ["rect", 0, 1120, 540, 1180, "#f2dc9e"],
        ["rect", 0, 1120, 540, 360, "#e6c987"],
      ],
      marks: [["waves", 0, 420, 540, 680, "#bfe7ff", 40], ["dots", 0, 1130, 540, 1160, "#d8b86e", 120]],
      zones: [
        { id: "sky", rect: [0, 30, 540, 340], n: 7, kinds: { bird: 3, kite: 2, airplane: 1, helicopter: 1, cloud: 2, balloon: 1 }, fixed: ["sun"] },
        { id: "sea", rect: [0, 430, 540, 660], n: 17, kinds: { sailboat: 3, speedboat: 1, whale: 1, dolphin: 2, fish: 3, octopus: 1, swimmer: 2, surfer: 2, turtle: 1, shark: 1, rower: 1 } },
        { id: "shore", rect: [0, 1140, 540, 320], n: 12, kinds: { crab: 3, shell: 3, bucket: 2, stander: 2, dog: 1, seal: 1, volleyball: 1 } },
        { id: "sand", rect: [0, 1480, 540, 800], n: 20, props: ["umbrella", "palm", "umbrella", "palm"], kinds: { umbrella: 1, volleyball: 2, shavedice: 2, watermelon: 1, coconut: 2, sunglasses: 2, sandal: 2, bucket: 1, stander: 2, walker: 2, friends: 1, crab: 1, shell: 1 } },
      ],
      hide: ["umbrella", "palm"],
      finds: { helicopter: 1, speedboat: 1, whale: 1, octopus: 1, turtle: 1, shark: 1, surfer: 1, rower: 1, seal: 1, dog: 1, volleyball: 1, watermelon: 1, sunglasses: 1, sandal: 1, friends: 1, shavedice: 1,
        crab: "count", shell: "count", sailboat: "count", fish: "count", bucket: "count" },
    },
    {
      id: "farm", name: "Farm Day", door: "tractor", h: 2300, sky: "#c2e6ff",
      ground: [
        ["rect", 0, 0, 540, 360, "#c9eaff"],
        ["ellipse", 270, 380, 420, 90, "#b4dc8a"],
        ["rect", 0, 360, 540, 1940, "#a6d47a"],
        ["rect", 0, 1060, 540, 520, "#b98a55"],
        ["rect", 0, 1590, 540, 700, "#93c868"],
        ["ellipse", 400, 2020, 120, 80, "#6dbbe4"],
        ["path", "M 270 360 C 250 600 300 800 270 1060", "#e3cf9d", 44],
      ],
      marks: [["tufts", 0, 370, 540, 680, "#8cc363", 40], ["stripes", 0, 1080, 540, 480, "#9c6f3f", 9], ["tufts", 0, 1600, 540, 680, "#7db554", 50]],
      zones: [
        { id: "sky", rect: [0, 30, 540, 310], n: 6, kinds: { bird: 3, cloud: 2, butterfly: 1, honeybee: 1 }, fixed: ["sun"] },
        { id: "yard", rect: [0, 380, 540, 660], n: 16, props: ["hut", "house", "tree"], kinds: { tractor: 1, farmer: 2, dog: 1, cat: 2, chicken: 3, rooster: 1, chick: 3, mouse: 1, rabbit: 1 } },
        { id: "field", rect: [0, 1080, 540, 480], n: 18, kinds: { corn: 4, carrot: 4, sunflower: 2, mouse: 1, rabbit: 2, honeybee: 1, butterfly: 1 } },
        { id: "pasture", rect: [0, 1600, 540, 680], n: 15, props: ["tree", "tree"], kinds: { cow: 3, pig: 3, sheep: 3, goat: 1, horse: 1, duck: 2, frog: 1, chick: 1 } },
      ],
      hide: ["hut", "house", "tree"],
      finds: { tractor: 1, farmer: 1, dog: 1, cat: 1, rooster: 1, mouse: 1, goat: 1, horse: 1, frog: 1, duck: 1,
        chicken: "count", chick: "count", corn: "count", carrot: "count", cow: "count", pig: "count", sheep: "count", sunflower: "count" },
    },
    {
      id: "town", name: "Busy Town", door: "bus", h: 2500, sky: "#cde9ff",
      ground: [
        ["rect", 0, 0, 540, 460, "#d3ecff"],
        ["rect", 0, 440, 540, 480, "#d7d2c8"],
        ["rect", 0, 920, 540, 640, "#6b6f78"],
        ["path", "M 0 1240 L 540 1240", "#f5f5f5", 6],
        ["rect", 0, 1560, 540, 140, "#d7d2c8"],
        ["rect", 0, 1700, 540, 800, "#9fd27a"],
        ["ellipse", 270, 2100, 200, 150, "#e9dcb8"],
      ],
      marks: [["stripes", 0, 940, 540, 600, "#ffd54a", 6], ["dots", 0, 450, 540, 460, "#c4beb2", 60], ["tufts", 0, 1710, 540, 780, "#86bf5f", 50]],
      zones: [
        { id: "buildings", rect: [0, 30, 540, 410], n: 4, props: ["house", "store", "school", "hospital", "office", "postoffice"], kinds: { bird: 2, balloon: 1 } },
        { id: "sidewalk", rect: [0, 470, 540, 430], n: 15, props: ["trafficlight"], kinds: { police: 1, firefighter: 1, builder: 1, cook: 1, doctor: 1, teacher: 1, walker: 3, stander: 2, dog: 2, cat: 1, postbox: 1, icecream: 1, sign: 1, balloon: 1 } },
        { id: "road", rect: [0, 950, 540, 590], n: 12, kinds: { car: 3, taxi: 2, bus: 1, policecar: 1, fireengine: 1, ambulance: 1, truck: 1, biker: 2, motorscooter: 1 } },
        { id: "plaza", rect: [0, 1700, 540, 780], n: 18, props: ["fountain", "tree", "tree"], kinds: { juggler: 1, runner: 2, scooter: 2, balloon: 2, dog: 1, bird: 2, ball: 2, icecream: 1, stander: 2, artist: 1, friends: 1, wheelchair: 1 } },
      ],
      hide: ["tree", "fountain", "house", "store", "school"],
      finds: { police: 1, firefighter: 1, builder: 1, cook: 1, doctor: 1, teacher: 1, wheelchair: 1, postbox: 1, sign: 1, bus: 1, policecar: 1, fireengine: 1, ambulance: 1, truck: 1, motorscooter: 1, juggler: 1, artist: 1, friends: 1,
        car: "count", taxi: "count", balloon: "count", ball: "count" },
    },
    {
      id: "zoo", name: "Zoo Day", door: "elephant", h: 2400, sky: "#cfeaff",
      ground: [
        ["rect", 0, 0, 540, 800, "#ead9a0"],
        ["rect", 0, 0, 540, 120, "#cde9ff"],
        ["rect", 0, 800, 540, 620, "#5fa356"],
        ["rect", 0, 1420, 540, 480, "#7fc2c9"],
        ["ellipse", 270, 1660, 240, 190, "#5fb3df"],
        ["rect", 0, 1900, 540, 500, "#eaf6ff"],
        ["ellipse", 160, 2160, 140, 80, "#a9dcf4"],
      ],
      marks: [["dots", 0, 130, 540, 660, "#d6c07e", 70], ["tufts", 0, 810, 540, 600, "#4d8f45", 60], ["waves", 40, 1500, 460, 320, "#dff4ff", 14], ["dots", 0, 1910, 540, 480, "#cfe6f5", 50]],
      zones: [
        { id: "savanna", rect: [0, 130, 540, 660], n: 12, props: ["palm", "palm"], kinds: { lion: 1, giraffe: 2, zebra: 3, elephant: 1, rhino: 1, camel: 1, bird: 2 } },
        { id: "jungle", rect: [0, 820, 540, 580], n: 13, props: ["tree", "pine", "tree"], kinds: { monkey: 3, gorilla: 1, parrot: 3, snake: 1, sloth: 1, tiger: 1, peacock: 1, butterfly: 2 } },
        { id: "lake", rect: [40, 1480, 460, 380], oval: true, n: 10, kinds: { hippo: 1, crocodile: 1, flamingo: 3, turtle: 2, duck: 2, fish: 2 } },
        { id: "ice", rect: [0, 1920, 540, 460], n: 13, props: ["rock", "rock"], kinds: { penguin: 4, polarbear: 1, seal: 2, stander: 2, walker: 2, balloon: 1, icecream: 1 } },
      ],
      hide: ["tree", "pine", "palm", "rock"],
      finds: { lion: 1, elephant: 1, rhino: 1, camel: 1, gorilla: 1, snake: 1, sloth: 1, tiger: 1, peacock: 1, hippo: 1, crocodile: 1, polarbear: 1, seal: 1,
        zebra: "count", giraffe: "count", monkey: "count", parrot: "count", flamingo: "count", penguin: "count" },
    },
    {
      id: "space", name: "Space Trip", door: "rocket", h: 2300, sky: "#1d2350", dark: true,
      ground: [
        ["rect", 0, 0, 540, 2300, "#1b2050"],
        ["rect", 0, 0, 540, 600, "#141842"],
        ["ellipse", 140, 900, 260, 200, "#262b66"],
        ["ellipse", 420, 1300, 220, 180, "#2b2462"],
        ["ellipse", 270, 1700, 520, 160, "#9aa3b8"],
        ["rect", 0, 1700, 540, 600, "#9aa3b8"],
      ],
      marks: [["stars", 0, 0, 540, 1640, "#ffffff", 160], ["craters", 0, 1720, 540, 560, "#7f879d", 24]],
      zones: [
        { id: "far", rect: [0, 30, 540, 760], n: 13, kinds: { star: 5, planet: 2, comet: 2, moon: 1, satellite: 2, ufo: 1 }, fixed: ["sun"] },
        { id: "near", rect: [0, 800, 540, 860], n: 13, kinds: { rocket: 2, ufo: 2, astronaut: 3, satellite: 1, star: 3, planet: 1, comet: 1, monster: 1 } },
        { id: "moon", rect: [0, 1730, 540, 550], n: 15, props: ["rock", "rock", "rock"], kinds: { astronaut: 2, alien: 3, robot: 2, rocket: 1, telescope: 1, monster: 1, ufo: 1 } },
      ],
      hide: ["rock"],
      finds: { moon: 1, comet: 1, satellite: 1, ufo: 1, monster: 1, robot: 1, telescope: 1, planet: 1, rocket: 1,
        star: "count", astronaut: "count", alien: "count" },
    },
  ];

  // How hard a picture is grows with the stars a place has (0, 1, 2+):
  // more things around the finds, and the buddy hides further behind.
  const LEVELS = [
    { fill: 1.5, buddy: [0.62, 0.78], count: [2, 3] },
    { fill: 1.8, buddy: [0.5, 0.66], count: [3, 4] },
    { fill: 2.1, buddy: [0.42, 0.56], count: [3, 5] },
  ];

  // Every line the world says. A line never reads a picture: it names things
  // by their `say` / `many`.
  const SAY = {
    pick: "Pick a place to look!",
    find: (names) => "Can you find " + names + "?",
    found: (name) => "You found the " + name + "!",
    foundAll: (n, many) => n + " " + many + "! You found them all!",
    buddy: (name) => "You found " + name + "!",
    that: (phrase) => "That's " + phrase + ".",
    win: "You found everything!",
    look: "Look here!",
  };

  // The world's own mark: on the front door and its home.
  const LOGO = "magnifying-glass-tilted-left";

  const SeekData = { W, TONES, KINDS, PLACES, LEVELS, SAY, LOGO };
  if (typeof module !== "undefined" && module.exports) module.exports = SeekData;
  global.SeekData = SeekData;
})(typeof window !== "undefined" ? window : globalThis);
