// Games the API accepts scores for, with limits used to reject impossible scores.
// maxPerSecond is generous: a perfect player can't earn points faster than this.
const GAMES = {
  'rooftop-runner': { name: 'Rooftop Runner', maxPerSecond: 120, minSeconds: 3 },
  'night-heist': { name: 'Night Heist', maxPerSecond: 200, minSeconds: 5 },
  'wingsuit-canyon': { name: 'Wingsuit Canyon', maxPerSecond: 250, minSeconds: 3 },
  // Saved by the server itself at the end of a match; clients can't post these.
  'museum-hide-seek': { name: 'Museum Hide & Seek', serverOnly: true },
  'ragdoll-arena': { name: 'Ragdoll Arena', maxPerSecond: 50, minSeconds: 5 },
};

module.exports = { GAMES };
