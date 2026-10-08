// waves.js — 15 wave definitions. W1-W2 real per contract; W3-W15 are
// plausible placeholders (enemies-waves job finalizes).
export const WAVES = [
  { name: 'W1', gold: 25, spawns: [
    { t: 'grunt', n: 6, gap: 1.0, delay: 0 } ] },
  { name: 'W2', gold: 30, spawns: [
    { t: 'grunt', n: 4, gap: 1.0, delay: 0 },
    { t: 'runner', n: 3, gap: 0.8, delay: 4 } ] },
  // TODO(enemies-waves): finalize W3-W15 mix.
  { name: 'W3', gold: 35, spawns: [
    { t: 'grunt', n: 5, gap: 0.9, delay: 0 },
    { t: 'tank', n: 1, gap: 1, delay: 6 } ] },
  { name: 'W4', gold: 40, spawns: [
    { t: 'runner', n: 6, gap: 0.7, delay: 0 },
    { t: 'flyer', n: 3, gap: 1.2, delay: 5 } ] },
  { name: 'W5', gold: 45, spawns: [
    { t: 'grunt', n: 6, gap: 0.8, delay: 0 },
    { t: 'shield', n: 2, gap: 2.0, delay: 4 } ] },
  { name: 'W6', gold: 50, spawns: [
    { t: 'runner', n: 8, gap: 0.6, delay: 0 },
    { t: 'tank', n: 2, gap: 3.0, delay: 5 } ] },
  { name: 'W7', gold: 55, spawns: [
    { t: 'flyer', n: 6, gap: 0.9, delay: 0 },
    { t: 'shield', n: 3, gap: 2.0, delay: 6 } ] },
  { name: 'W8', gold: 60, spawns: [
    { t: 'grunt', n: 10, gap: 0.6, delay: 0 },
    { t: 'tank', n: 3, gap: 2.5, delay: 4 } ] },
  { name: 'W9', gold: 65, spawns: [
    { t: 'runner', n: 10, gap: 0.5, delay: 0 },
    { t: 'flyer', n: 5, gap: 1.0, delay: 5 } ] },
  { name: 'W10', gold: 70, spawns: [
    { t: 'shield', n: 5, gap: 1.5, delay: 0 },
    { t: 'tank', n: 3, gap: 2.0, delay: 6 } ] },
  { name: 'W11', gold: 75, spawns: [
    { t: 'grunt', n: 12, gap: 0.5, delay: 0 },
    { t: 'runner', n: 8, gap: 0.5, delay: 4 } ] },
  { name: 'W12', gold: 80, spawns: [
    { t: 'flyer', n: 8, gap: 0.8, delay: 0 },
    { t: 'shield', n: 4, gap: 1.5, delay: 5 } ] },
  { name: 'W13', gold: 85, spawns: [
    { t: 'tank', n: 5, gap: 1.8, delay: 0 },
    { t: 'runner', n: 10, gap: 0.4, delay: 6 } ] },
  { name: 'W14', gold: 90, spawns: [
    { t: 'shield', n: 6, gap: 1.2, delay: 0 },
    { t: 'flyer', n: 8, gap: 0.7, delay: 5 },
    { t: 'tank', n: 4, gap: 2.0, delay: 8 } ] },
  { name: 'W15', gold: 150, spawns: [
    { t: 'grunt', n: 8, gap: 0.8, delay: 0 },
    { t: 'runner', n: 8, gap: 0.6, delay: 6 },
    { t: 'boss', n: 1, gap: 1, delay: 20 } ] }
];
