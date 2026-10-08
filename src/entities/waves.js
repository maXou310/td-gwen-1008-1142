// waves.js — final 15-wave design (enemies-waves job).
// Shape: { name:'W'+n, gold:clearBonus, spawns:[{t,n,gap,delay,hp}] }
// hp = per-enemy HP multiplier for that spawn group.
export const WAVES = [
  { name: 'W1', gold: 25, spawns: [
    { t: 'grunt', n: 6, gap: 1.0, delay: 0 } ] },
  { name: 'W2', gold: 30, spawns: [
    { t: 'grunt', n: 5, gap: 0.9, delay: 0 },
    { t: 'runner', n: 4, gap: 0.7, delay: 3 } ] },
  { name: 'W3', gold: 35, spawns: [
    { t: 'grunt', n: 6, gap: 0.8, delay: 0 },
    { t: 'tank', n: 1, gap: 1, delay: 5 } ] },
  { name: 'W4', gold: 40, spawns: [
    { t: 'runner', n: 6, gap: 0.6, delay: 0 },
    { t: 'flyer', n: 4, gap: 1.0, delay: 4 } ] },
  { name: 'W5', gold: 45, spawns: [
    { t: 'grunt', n: 6, gap: 0.8, delay: 0 },
    { t: 'shield', n: 3, gap: 1.8, delay: 4 } ] },
  { name: 'W6', gold: 50, spawns: [
    { t: 'runner', n: 6, gap: 0.5, delay: 0 },
    { t: 'tank', n: 2, gap: 2.5, delay: 4 },
    { t: 'flyer', n: 3, gap: 1.2, delay: 6 } ] },
  { name: 'W7', gold: 55, spawns: [
    { t: 'flyer', n: 5, gap: 0.8, delay: 0 },
    { t: 'shield', n: 3, gap: 1.8, delay: 5 },
    { t: 'grunt', n: 4, gap: 0.7, delay: 8 } ] },
  // --- HP x1.1 from here ---
  { name: 'W8', gold: 60, spawns: [
    { t: 'tank', n: 3, gap: 2.2, delay: 0, hp: 1.1 },
    { t: 'shield', n: 4, gap: 1.6, delay: 4, hp: 1.1 },
    { t: 'grunt', n: 6, gap: 0.6, delay: 8, hp: 1.1 } ] },
  { name: 'W9', gold: 65, spawns: [
    { t: 'runner', n: 9, gap: 0.45, delay: 0, hp: 1.1 },
    { t: 'flyer', n: 4, gap: 0.9, delay: 4, hp: 1.1 } ] },
  { name: 'W10', gold: 70, spawns: [
    { t: 'shield', n: 5, gap: 1.4, delay: 0, hp: 1.1 },
    { t: 'tank', n: 3, gap: 2.0, delay: 5, hp: 1.1 },
    { t: 'runner', n: 5, gap: 0.5, delay: 8, hp: 1.1 } ] },
  // --- HP x1.2 from here ---
  { name: 'W11', gold: 75, spawns: [
    { t: 'grunt', n: 8, gap: 0.5, delay: 0, hp: 1.2 },
    { t: 'runner', n: 6, gap: 0.4, delay: 4, hp: 1.2 },
    { t: 'flyer', n: 3, gap: 1.0, delay: 8, hp: 1.2 } ] },
  { name: 'W12', gold: 80, spawns: [
    { t: 'runner', n: 10, gap: 0.4, delay: 0, hp: 1.2 },
    { t: 'flyer', n: 5, gap: 0.9, delay: 4, hp: 1.2 } ] },
  { name: 'W13', gold: 85, spawns: [
    { t: 'tank', n: 4, gap: 1.8, delay: 0, hp: 1.2 },
    { t: 'runner', n: 8, gap: 0.4, delay: 5, hp: 1.2 },
    { t: 'shield', n: 3, gap: 1.6, delay: 9, hp: 1.2 } ] },
  // --- HP x1.3 ---
  { name: 'W14', gold: 90, spawns: [
    { t: 'tank', n: 6, gap: 1.6, delay: 0, hp: 1.3 },
    { t: 'shield', n: 4, gap: 1.4, delay: 5, hp: 1.3 },
    { t: 'runner', n: 8, gap: 0.4, delay: 9, hp: 1.3 } ] },
  // --- Boss wave, HP x1.5 ---
  { name: 'W15', gold: 50, spawns: [
    { t: 'boss', n: 1, gap: 1, delay: 20, hp: 2.4 },
    { t: 'tank', n: 5, gap: 2.0, delay: 5, hp: 2.2 },
    { t: 'shield', n: 6, gap: 1.5, delay: 10, hp: 2.2 },
    { t: 'runner', n: 9, gap: 0.5, delay: 15, hp: 2.2 } ] }
];
