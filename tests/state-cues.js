// The STATE PAIRS the colour law (site.test.js, "told apart by COLOUR alone")
// cannot weigh from the stylesheet alone: a side's fill is TRANSLUCENT, so it
// composites over whatever is behind it and has no lightness a text scan can
// read, and nothing structural separates the two states. Each is classified by
// what ACTUALLY carries the state.
//
// ONE OWNER, read by two files: site.test.js requires this list to EQUAL what
// it derives, so a new such pair is red until somebody classifies it here; and
// e2e.test.js measures every `composite` entry in a real browser, so a pair
// whose only cue is its fill is weighed on the backdrop it actually sits on.
module.exports = {
  ".drum__dot (base) vs --on": {
    cue: "composite",
    game: "drum-parts", base: ".drum__dot", state: "drum__dot--on",
    why: "Drum the Word's pulse dots ARE its sound-off channel — a child with the sound off " +
      "counts the lit ones — and the off dot is its own colour at 18%, so what it looks like " +
      "depends on the stage behind it.",
  },
  ".body__zone (base) vs --hit": {
    cue: "transient",
    why: "a flash on a correct tap that every non-final round rebuilds away in the same tick, " +
      "so it only ever paints on the WINNING tap, under the win celebration.",
  },
  ".td-hud__charge (base) vs .is-buyable": {
    cue: "attribute",
    why: "the unbuyable state is [aria-disabled] at 0.75 opacity with its price in ink — an " +
      "ATTRIBUTE state this class-grouped law does not model — and it is pinned by td.test.js's " +
      "\"⚙️ exchange: the BUTTON buys energy, and says why when it won't\".",
  },
};
