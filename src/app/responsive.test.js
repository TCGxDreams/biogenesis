import { afterEach, describe, expect, it, vi } from 'vitest';
import { initResponsiveLayout, openResponsiveSidebar } from './responsive.js';
afterEach(() => vi.unstubAllGlobals());
function setup(isMobile) {
    const elements = {};
    function element(id) {
        const classes = new Set();
        return elements[id] = {
            inert:false, hidden:false, attrs:{}, listeners:{},
            classList:{contains:key=>classes.has(key),toggle:(key,on)=>on?classes.add(key):classes.delete(key)},
            setAttribute(key,value){this.attrs[key]=value;},
            addEventListener(event,fn){this.listeners[event]=fn;},
            querySelectorAll:()=>[],querySelector:()=>null,contains:()=>false,
            focus:vi.fn(),
        };
    }
    for (const id of ['main-layout','sidebar','content-area','sidebar-toggle','sidebar-backdrop','sidebar-close']) element(id);
    const media = {matches:isMobile,addEventListener:vi.fn((_,fn)=>{media.change=fn;})};
    const doc = {getElementById:id=>elements[id]||null,addEventListener:vi.fn(),activeElement:null};
    vi.stubGlobal('document',doc); vi.stubGlobal('window',{matchMedia:()=>media});
    initResponsiveLayout();
    return {elements,media};
}
describe('responsive navigation', () => {
    it('starts mobile with hidden, unfocusable navigation and an available workspace', () => {
        const {elements:e}=setup(true);
        expect(e.sidebar.inert).toBe(true);
        expect(e['content-area'].inert).toBe(false);
        expect(e['sidebar-toggle'].attrs['aria-expanded']).toBe('false');
        expect(e['sidebar-backdrop'].hidden).toBe(true);
    });
    it('opens a modal drawer and restores the workspace when the backdrop closes it', () => {
        const {elements:e}=setup(true);
        e['sidebar-toggle'].listeners.click();
        expect(e.sidebar.inert).toBe(false);
        expect(e['content-area'].inert).toBe(true);
        expect(e['sidebar-close'].focus).toHaveBeenCalled();
        e['sidebar-backdrop'].listeners.click();
        expect(e['content-area'].inert).toBe(false);
        expect(e.sidebar.inert).toBe(true);
        expect(e['sidebar-toggle'].focus).toHaveBeenCalled();
    });
    it('clears modal state on desktop resizing', () => {
        const {elements:e,media}=setup(true);
        openResponsiveSidebar();
        media.matches=false;media.change();
        expect(e['content-area'].inert).toBe(false);
        expect(e.sidebar.inert).toBe(false);
        expect(e['sidebar-backdrop'].hidden).toBe(true);
    });
    it('preserves a collapsed desktop sidebar after a mobile round trip', () => {
        const {elements:e,media}=setup(false);
        e['sidebar-toggle'].listeners.click();
        expect(e.sidebar.inert).toBe(true);
        media.matches=true;media.change();openResponsiveSidebar();
        media.matches=false;media.change();
        expect(e.sidebar.inert).toBe(true);
        expect(e['content-area'].inert).toBe(false);
    });
});
