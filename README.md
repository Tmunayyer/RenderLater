# RenderLater
Progressive Hydration React component implementation.

With Google adding page speed as a factor for SEO, your applications performance is more important than ever. If your running a single page application that has some complexity to it, you might be finding total blocking time is a big issue.

This goal of this component is to provide a simple API to wrap components and inform the browser they can render them "later".

**Challenges**
- One big challenge is how to do this with SSR. Simply returning null for a period of time is not acceptable if the skeleton or the component is already displayed on the page. How then do we start and stop the hydration process?

- Another challenge is how do we tell the Javascript to take back control when we need a component right away?

**Solution**
In order to incorporate progressive rendering/hydration, well need a way of stopping the javascript, scheduling it for a later time, and returning what is already on the page. To do this well also need to break the rules of React slightly, but only for a short time.

**Order of Operations**
1. During SSR, place strategic div elements as "checkpoints" of rendering/hydration.
2. Put the SSR result onto the page.
3. During Hydration, once a checkpoint is reached, select what is on the page and return it (static HTML).
4. Schedule an update to occur at a later time that will proceed with everything after the checkpoint, potentially other checkpoints.

**Requirements**
- The component should be non-invasive and easy to add or remove.
- The component should have a click handler to schedule an immediate hydration.

