# Contributing to Hope Seeker AI

First off, thank you for taking the time to contribute! Contributions are what make the open-source community such an amazing place to learn, inspire, and create.

All types of contributions are encouraged and valued. See the Table of Contents below for different ways to help and details about how this project handles them. Please make sure to read the relevant section before making your contribution.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How Can I Contribute?](#how-can-i-contribute)
  - [Reporting Bugs](#reporting-bugs)
  - [Suggesting Enhancements](#suggesting-enhancements)
  - [Pull Requests](#pull-requests)
- [Styleguides](#styleguides)
  - [JavaScript Styleguide](#javascript-styleguide)
  - [CSS Styleguide](#css-styleguide)

## Code of Conduct

This project and everyone participating in it is governed by the [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## How Can I Contribute?

### Reporting Bugs

If you find a bug, please open an issue on GitHub. Before submitting, please search the issue tracker to see if the bug has already been reported.

When creating a bug report, please include as much detail as possible:
- A clear description of the bug.
- Steps to reproduce the bug.
- Expected behavior vs. actual behavior.
- Browser name and version, OS, Node.js version.
- Console logs or error outputs (if applicable).

### Suggesting Enhancements

If you want to suggest a new feature or improvement, please open a feature request issue. Explain why this enhancement would be useful and how it should work.

### Pull Requests

Please follow these steps to submit a Pull Request (PR):
1. Fork the repository.
2. Create a new branch for your feature or bug fix: `git checkout -b feature/your-feature-name` or `bugfix/your-bug-fix`.
3. Make your changes and commit them with descriptive commit messages.
4. Ensure code passes local linting or tests: `node test-api.js` to verify backend integrity.
5. Push to your fork: `git push origin feature/your-feature-name`.
6. Open a Pull Request against the `main` branch of this repository.
7. Explain your changes in detail in the PR description.

## Styleguides

### JavaScript Styleguide

- Use modern ES6+ features.
- Write clean, commented code.
- Prefer asynchronous features (`async/await`) over raw Promises/callbacks for clarity.
- Keep the Express routes modular and separated.

### CSS Styleguide

- Use modern Vanilla CSS with CSS variables.
- Prioritize responsiveness and accessibility (high-contrast, touch-friendly tap targets).
- Maintain glassmorphic dark design patterns consistent with the current aesthetics.
