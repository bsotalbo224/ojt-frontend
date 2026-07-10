// src/constants/reactions.js

export const REACTIONS = {
  like: {
    label: "Like",
    unicode: "1f44d",
  },
  love: {
    label: "Love",
    unicode: "2764",
  },
  laugh: {
    label: "Laugh",
    unicode: "1f602",
  },
  wow: {
    label: "Wow",
    unicode: "1f62e",
  },
  sad: {
    label: "Sad",
    unicode: "1f622",
  },
  angry: {
    label: "Angry",
    unicode: "1f620",
  },
};

export const REACTION_CODES = Object.keys(REACTIONS);

export const isValidReactionCode = (code) =>
  typeof code === "string" && Object.prototype.hasOwnProperty.call(REACTIONS, code);

export const getReactionMeta = (code) => (isValidReactionCode(code) ? REACTIONS[code] : null);