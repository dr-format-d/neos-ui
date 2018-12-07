import {omit} from 'lodash';
import React, {PureComponent, ReactNode, SyntheticEvent} from 'react';
import ReactDOM from 'react-dom';

export interface FrameProps extends React.IframeHTMLAttributes<HTMLIFrameElement> {
    readonly src: string;
    readonly mountTarget: string;
    readonly contentDidUpdate: (window: Window, document: Document, mountTarget: Element) => void;
    readonly onLoad: (event: SyntheticEvent<HTMLIFrameElement>) => void;
    readonly onUnload: () => void;
    readonly children: ReactNode;
}

export default class Frame extends PureComponent<FrameProps> {
    // tslint:disable-next-line:readonly-keyword
    private ref?: HTMLIFrameElement;

    public render(): JSX.Element {
        const rest = omit(this.props, [
            'mountTarget',
            'contentDidUpdate',
            'theme',
            'children',
            'onLoad',
            'onUnload',
            'src'
        ]);

        return <iframe ref={this.handleReference} {...rest} onLoad={this.handleLoad} />;
    }

    private readonly handleReference = (ref: HTMLIFrameElement) => {
        // tslint:disable-next-line:no-object-mutation
        this.ref = ref;
    }

    public componentDidMount(): void {
        this.updateIframeUrlIfNecessary();
        this.addClickListener();
    }

    private readonly addClickListener = () => {
        if (this.ref && this.ref.contentDocument) {
            this.ref.contentDocument.addEventListener('click', () => {
                this.relayClickEventToHostDocument();
            });
        }
    }

    private readonly removeClickListener = () => {
        if (this.ref && this.ref.contentDocument) {
            this.ref.contentDocument.removeEventListener('click', this.relayClickEventToHostDocument);
        }
    }

    private readonly relayClickEventToHostDocument = () => {
        window.document.dispatchEvent(new MouseEvent('click'));
    }

    public componentWillUpdate(): void {
        this.removeClickListener();
    }

    public componentDidUpdate(): void {
        this.updateIframeUrlIfNecessary();
        this.addClickListener();
    }

    // We do not use react's magic to change to a different URL in the iFrame, but do it
    // explicitely (in order to avoid reloads if we are already on the correct page)
    private updateIframeUrlIfNecessary(): void {
        if (!this.ref) {
            return;
        }

        try {
            const win = this.ref.contentWindow; // eslint-disable-line react/no-find-dom-node
            if (win && win.location.href !== this.props.src) {
                win.location.replace(this.props.src);
            }
        } catch (err) {
            // tslint:disable-next-line:no-console
            console.error('Could not update iFrame Url from within. Trying to set src attribute manually...');
            this.ref.setAttribute('src', this.props.src);
        }
    }

    public componentWillMount(): void {
        document.addEventListener('Neos.Neos.Ui.ContentReady', this.renderFrameContents);
    }

    private readonly handleLoad = (e: SyntheticEvent<HTMLIFrameElement>) => {
        const {onLoad} = this.props;

        if (typeof onLoad === 'function' && this.ref) {
            onLoad(e);
        }
    }

    private readonly renderFrameContents = () => {
        if (this.ref) {
            const doc = this.ref.contentDocument;
            const win = this.ref.contentWindow;

            if (win && doc) {
                win.addEventListener('unload', this.props.onUnload);

                const mountTarget = doc.querySelector(this.props.mountTarget);
                const contents = React.createElement('div', undefined, this.props.children);
                const iframeHtml = doc.querySelector('html');

                if (iframeHtml) {
                    // Center iframe
                    iframeHtml.style.setProperty('margin', '0 auto');
                }

                if (mountTarget) {
                    // TODO: the way to fix this, we could use a portal: https://gist.github.com/robertgonzales/b1966af8d2a428a8299663b92fb2fe03
                    ReactDOM.unstable_renderSubtreeIntoContainer(this, contents, mountTarget, () => {
                        this.props.contentDidUpdate(win, doc, mountTarget);
                    });
                }
            }
        }
    }

    public componentWillUnmount(): void {
        if (this.ref) {
            const doc = this.ref.contentDocument; // eslint-disable-line react/no-find-dom-node
            document.removeEventListener('Neos.Neos.Ui.ContentReady', this.renderFrameContents);
            if (doc) {
                ReactDOM.unmountComponentAtNode(doc.body);
            }
        }
        this.removeClickListener();
    }
}
