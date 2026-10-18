# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Existing static HTML, CSS and JavaScript site. GitHub Pages is the deployment target.

## Users

The primary users are the course instructor and classmates reviewing an individual deep-learning project. They need to understand the business problem, inspect a saved prediction, and follow how the data moves from the notebook into the demo.

## Product Purpose

EV Watch is an educational dashboard for an early-warning experiment. It presents the probability that an electric-vehicle charging area may reach high occupancy in the following hour, using saved outputs from an LSTM experiment on the public UrbanEV dataset.

## Positioning

The demo connects a sequence-model result to a concrete operating view: an area, a time, a probability, its recent trajectory, and its location among other charging areas. It is an explanation and review surface, not a live dispatch system.

## Operating Context

The viewer selects a charging area and an observation time, reads the current and next-hour rates, checks the probability trend and map, then follows links to the method, dataset, results and original sources. The browser reads static JSON artifacts and does not retrain the model.

## Capabilities and Constraints

- Vietnamese and English content switching.
- Light and dark themes.
- Responsive layout with a left-opening mobile navigation drawer.
- Interactive custom selectors for area and time.
- Interactive SVG map using source-area coordinates and saved predictions.
- Saved metrics, figures and predictions are the source of displayed values.
- The demo must work as a static GitHub Pages site without a build step or server-side code.
- No live charging infrastructure, authentication or commercial claim is part of the product.

## Brand Commitments

The name is EV Watch. Copy should be direct, human and academic rather than promotional. The interface should feel like a serious mobility-operations instrument with enough visual personality to make a research result easy to understand.

## Evidence on Hand

- Public UrbanEV CSV files in `data/UrbanEV/`.
- Notebook in `notebooks/01_ev_area_early_warning.ipynb`.
- Saved metrics, predictions and figures in `artifacts/`.
- Current web data in `web/data/demo.json` and `web/data/zones.json`.
- Original dataset links in the current README and web source section.

## Product Principles

1. Show the prediction in context, not as an isolated score.
2. Make the model and data understandable to a non-specialist reviewer.
3. Use real experiment outputs and label illustrative values honestly.
4. Keep the static demo fast, keyboard-friendly and easy to inspect.
5. Preserve the distinction between an academic signal and an operational guarantee.

## Accessibility & Inclusion

The site should meet practical WCAG AA expectations for contrast, keyboard access, focus visibility, reduced motion and readable Vietnamese and English copy. Important meaning must not rely on color alone.

## Visual Direction Note

The visual direction is inferred from the user's explicit redesign request and existing product evidence. It is not a new product claim. The redesign should replace the current teal/yellow treatment with an urban-mobility palette built around graphite surfaces, electric orange for warnings and ice blue for analytical context, with real charts and the geographic map carrying the visual interest.
