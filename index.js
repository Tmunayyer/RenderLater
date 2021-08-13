import React from "react"

class ElementManager {
    constructor() {
        this.noRef = null;
        this.isSSR = typeof window === 'undefined';
        this.hasCapturedElems = false;

        if (!this.isSSR) {
            this.noRef = document.createElement('div');
        }

        this.refs = new Map();

        this.ssrRootNode = this.noRef;
        this.getRoot = () => this.noRef;
    }

    saveInitialHTML(id, rootNode) {
        this.refs.set(id, rootNode.firstChild ?? this.noRef);
    }

    queryStaticHTML(id) {
        const roots = this.refs.entries();
        let root = this.refs.get(id);

        // if the requested div id is found as one of
        // the roots, dont ever querySelector
        if (root) {
            return root;
        }

        // eslint-disable-next-line no-cond-assign
        while (root = roots.next().value) {
            const [, html] = root;
            const ref = html.querySelector(`#${id}`);

            if (ref) {
                // we found some static html to append to the current doc,
                // now we need to store the ref for possible nested hydrate later
                // lookups
                this.refs.set(id, ref);

                // use the ref from the map to be sure
                return ref;
            }
        }

        return this.noRef;
    }

    freeMemory(id) {
        this.refs.delete(id);
    }
}

export const elementManager = new ElementManager();

// reconcile browser functions
let eventLoopQueuer = setTimeout;
let eventLoopCleaner = clearTimeout;
// prefer idle callback when possible
if (typeof requestIdleCallback !== 'undefined') {
    /**
    * requestIdleCallback is a newer function but the one we want when
    * available. Its lower priority than setTimeout so more likely to
    * keep the main thread free.
    *
    * We handle this low priority by adding the "onClick" to the
    * placeholder component.
    */
    eventLoopQueuer = requestIdleCallback;
    eventLoopCleaner = cancelIdleCallback;
}

// eslint-disable-next-line react/prop-types
const Placeholder = ({ content, renderNow }) => (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div
        ref={(thisDiv) => thisDiv && thisDiv.appendChild(content)}
        // if a user tries to use a component, hyrdate immediatly
        onClick={renderNow}
        onKeyDown={renderNow}
    />
);

export const HydrateLater = ({
    // eslint-disable-next-line react/prop-types
    children, id, style = {}, className = '',
}) => {
    const ffIsProgressiveHydrationEnabled = useSelector(getFeatureFlag('is-progressive-hydration-enabled'));

    if (!ffIsProgressiveHydrationEnabled) {
        return children;
    }

    const isBot = useSelector(getIsBot);
    const isSSR = (typeof window === 'undefined');
    const isTestEnv = NODE_ENV === 'test';

    // initial state set to false unless we are a bot or its in SSR
    const [shouldRender, setShouldRender] = useState(isBot || isTestEnv || isSSR);

    const renderNow = useCallback(() => {
        if (shouldRender) return;

        setShouldRender(true);
    }, []);

    const callbackId = useRef(null);
    useEffect(() => {
        // component did mount

        // if we rendered on first pass, do nothing
        if (shouldRender) return noop;

        // otherwise schedule to set state "when idle" using the event
        // loop and give up main thread

        // set a reference to the id for cleanup incase a user clicks
        // on a queued component and we call renderNow directly
        callbackId.current = eventLoopQueuer(renderNow);

        return () => {
            // might have cleared already
            if (callbackId.current) eventLoopCleaner(callbackId.current);
        };
    }, []);

    useEffect(() => {
        if (shouldRender) {
            // we are done with the reference, delete it
            elementManager.freeMemory(id);
        }
    }, [shouldRender]);

    // clear the callback to prevent mem leaks
    if (shouldRender && callbackId.current) eventLoopCleaner(callbackId.current);

    if (!shouldRender) {
        const placeholderHTML = elementManager.queryStaticHTML(id);
        return <Placeholder content={placeholderHTML} renderNow={renderNow} />;
    }

    if (shouldRender && isSSR) {
        return (
            <div id={id} style={style} className={className}>
                {children}
            </div>
        );
    }

    return children;
};

export default HydrateLater;
