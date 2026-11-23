---
name: pr-text
description: Use when writing the text of a pull request (its title and body): before `gh pr create`, or when asked for a pull request description.
---

Write the body in three parts. Keep it short and use the project's own words.

## Summary

Say what was wrong or missing and what is different now, for whoever uses the code. Add the
smallest picture that shows it: a diff sketch of the logic, a call tree, a file tree or
pseudocode, each beside the sentence it supports.

## Evidence

Before and after, from commands you ran in this session. Paste the output lines as they were
printed: never retype them, put them in your own words or complete them from memory. Name each
new or changed test by its exact name. What was not run is written as "not run", with the
reason. A screenshot only when one was taken.

## Merge danger

- **Door:** one-way or two-way. Say how to roll back and what a rollback leaves behind: data
  already written, settings already changed.
- **Blast radius:** who and what the merge touches: stored data, configuration, callers, other
  versions running beside it. Only what the diff shows; a guess is written as a question.

Our adapted copy of the `pr` skill of `mattpocock/skills` (MIT: `LICENSE` beside this file), at
upstream commit `abeeaf95660ba9e8b7c753eb38f441ca707a8823` (19 November 2026); that skill credits
Humanlayer's `show-me`. The three parts above are the text that was tested
(`options/skills-compared.md` in the `cookbook` skill).
