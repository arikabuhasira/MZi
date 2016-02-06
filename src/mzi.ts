/********************************************************************************
* @file: mzi.ts
* @author: arik abuhaira (arikabuhasira@gmail.com)
*
* MZI - Multi Zone Splitter
********************************************************************************/

/// <reference path="jquery.d.ts" />

module mzi {

    // loggin 
    export var ilog = (msg: string) => console.log('<mzi> [I] ' + msg);
    export var elog = (msg: string) => console.log('<mzi> [E] ' + msg);
    export var vlog = (msg: string) => console.log('<mzi> [V] ' + msg);
    export var dlog = (msg: string) => console.log('<mzi> [D] ' + msg);

    // globals mzi default values.
    export var gripWidth = 2, gripHeight = 2;
    export var minWidthHeight = 50;   // minimal width/height

    var y = { a: 1, b: 1 }
    /**
     * Ui panel. 
     */
    export class Panel {
        private Guid: string;   	// like a window "handler" with a unique id.
        $wrapper: JQuery;			// wrapping edges grips and inner conent
        $panel: JQuery;				// inner content
        private rect: Rectangle;	// bounding rectangle

        constructor(rect?: Rectangle) {
            this.Guid = Guid();

            //wrapper
            this.$wrapper = $('<div class="panel"></div>');
            this.$wrapper.data('ui', this);   		// indirect access via HTML data-ui
            this.$wrapper.attr('uid', this.Guid); 	// <div uid='xxxx-xxxx-xxxx-xxxx' ...
            this.bound = rect;

            // content
            this.$panel = $('<div class="panel-content"></div>');
            this.$panel.appendTo(this.$w);
        }

        get guid(): string { return this.Guid; }		// unique id
        get $(): JQuery { return this.$panel; }		// inner content 
        get $w(): JQuery { return this.$wrapper; }	// wrapper (e.g: contains splitter grips and inner content)

        resize(w: number, h: number) {
            var r = this.bound;
            r.w = w; r.h = h;
            this.bound = r;
        }

        moveTo(x: number, y: number) {
            var r = this.bound;
            r.x = x; r.y = y;
            this.bound = r;
        }
        
        /** get/set bound rectagle **/
        public set bound(rect: Rectangle) {
            this.rect = (rect || Rectangle.empty()).clone();
            this.$wrapper.css({
                top: rect.y, left: rect.x,
                width: rect.w + 'px', height: rect.h + 'px'
            });
        }

        public get bound(): Rectangle {
            return this.rect.clone();
        }

        public get description(): string {
            var r = this.bound;
            return '*Panel#' + this.guid + ', bound:' + r.x + ',' + r.y + '^' + r.w + ',' + r.h;
        }
    } 
    /**
     * Mesh child panel 
     */
    export class MziPanel extends Panel {
        $grips: any = {};       // splitters grips

        static vh = {   // vh = vertical/horizontal 
            h: { cssClass: 'mzi-grip-horizontal', cursor: 'row-resize' },  // horizontal
            v: { cssClass: 'mzi-grip-vertical', cursor: 'col-resize' },    // vertical 
        }

        constructor(rect?: Rectangle) {
            super(rect);
            this.$w.addClass('mzi-panel');
            this.addGrip('left', 'right', 'top', 'bottom');
        }
        /**
         * add splitter grip handler
         */
        private addGrip(...dirs: string[]) {
            for (var i in dirs) {
                var dir = dirs[i];

                if (!/^(top|left|right|bottom)$/i.test(dir)) throw 'unkown grid edge';
                if (this.$grips[dir]) throw 'oops...grip ' + dir + ' already exists.';

                var isHorz = /^(top|bottom)$/.test(dir);

                var $grip = $('<div class="mzi-grip"></div>').addClass(dir);  // add left,right,top, bottom class
                $grip.attr('grip', dir);
                $grip.attr('splitter', isHorz ? 'h' : 'v');

                var vh = MziPanel.vh;
                var props = isHorz ? vh.h : vh.v;
                $grip.addClass(props.cssClass).css('cursor', props.cursor);
                $grip.prependTo(this.$wrapper);
                this.$grips[dir] = $grip;
            }
        }
        /** get parent mesh   (null=no parent) **/
        get mesh(): mzi.Mesh {
            var $parent = this.$.parent();
            if ($parent.length == 0) return null;
            var mesh = $parent.data('mzi');
            return mesh;
        }
        /** bind event to splitter grips **/
        public bindGrips(event: string, fn: Function) {
            for (var edge in this.$grips)
                this.$grips[edge].bind(event, fn);
        }
        /** unregiste event to grips **/
        public unbindGrips(event: string, fn: Function) {
            for (var edge in this.$grips)
                this.$grips[edge].unbind(event, fn);
        }

        public get description(): string {
            var r = this.bound;
            return '*MziPanel#' + this.guid + ', bound:' + r.x + ',' + r.y + '^' + r.w + ',' + r.h;
        }
    }
    /**
     * splitting/pulling info collected and using through mouse events: start, move and end
     */
    interface SplitContext {
        mode: string;       	// split, resize or remove
        isHorz: boolean;    // true = horizontal

        full?: boolean;     // only for split mode. split full mesh edge 
        offset?: number;    // bound mesh offset for calcultaing inner mesh relative points

        css: any;			// css properties for get/set css values according to current mode
        // vertical or horizontal 

        dragFrom: Point;    // point user drag from .
        dragTo?: Point;     // point user drag to.

        edge1?: Point;		// split line edge 1
        edge2?: Point;		// split line edge 2
    }

    /**
     * MZI panels container and manager pulling/splitting inner panels.
     */
    export class Mesh extends Panel {

        // css properties for split operations (split, resize and remove)
        static props = {
            h: { origin: 'top', page: 'pageY', barClass: 'horizontal' },
            v: { origin: 'left', page: 'pageX', barClass: 'vertical' }
        };

        private childs: any = {}               // child panels. keys = panel uid.
        private $splitter: JQuery;			   // drag splitter bar. for splitting, remove or resize.
	
        private context: SplitContext;		   // splitting/pulling operation info
        private stashedContext: SplitContext;  // push / pop context

        // split mouse events.
        public _onMouseDown: (evt) => void;
        public _onMouseMove: (evt) => void;
        public _onMouseEnd: (evt) => void;

        constructor(rect?: Rectangle, $root?: JQuery) {
            super(rect);

            initDEBUG();  // DELME/FIXME - remove to global mzi operations.

            var self = this;
            this._onMouseDown = (evt) => self.onMouseDown.call(self, evt);
            this._onMouseMove = (evt) => self.onMouseMove.call(self, evt);
            this._onMouseEnd = (evt) => self.onMouseEnd.call(self, evt);

            this.$wrapper.addClass('mzi-mesh');
            this.$wrapper.appendTo($root || $('body'));  // add to document.

            var r = new Rectangle(0, 0, rect.w, rect.h);
            this.add(new MziPanel(r)); // start with root panel.
        }

        add(panel: MziPanel) {
            if (this.childs[panel.guid] != null) throw 'panel <' + panel.guid + '> already exists';
            if (panel.mesh != null) throw 'panel <' + panel.guid + '> already attached';

            panel.$w.appendTo(this.$);
            this.childs[panel.guid] = panel;

            panel.bindGrips('mousedown', this._onMouseDown);
            ilog('add panel ' + panel.description);

            this.testRects();
        }

        remove(panel: MziPanel) {
            if (this.childs[panel.guid] == null) throw 'panel <' + panel.guid + '> not exists';
            
            // FIXME - I put on remark.  always fail with exception
            //if (panel.mesh == null)  			   throw 'panel <' + panel.guid + '> not attached to current mesh'

            delete this.childs[panel.guid];
            panel.$w.remove();
            ilog('remove panel ' + panel.description);

            this.testRects();
        }
        /***
         * mouse down, move and end 
         */
        onMouseDown(evt: any) {
            if (this.context) throw 'mesh mousedown with bad state.';

            var $el = $(evt.toElement);
            var at = this.coordinateAt(evt.pageX, evt.pageY);
            ilog('mousedown at ' + evt.pageX + ',' + evt.pageY + ', at=' + at.description);

            var isHorz = $el.attr('splitter') == 'h';
            var closest = this.getClosestPanels(isHorz, at);

            var n = closest.length;
            if (n == 0) return;  // not pressed on splitter line

            var ctx = this.context = {
                mode: closest.length == 1 ? 'split' : 'pull' /*==2*/,
                isHorz: isHorz,
                dragFrom: at,
                css: Mesh.props[isHorz ? 'h' : 'v'],
                offset: isHorz ? this.bound.top : this.bound.left,
                full: evt.shiftKey
            }


            if (n == 2) this.setPullMode(isHorz, at, ctx.full);
            else if (n == 1) this.setSplitMode(isHorz, at, ctx.full);
            else throw 'oops...bad panels length ' + closest.length;

            var p1 = this.context.edge1, p2 = this.context.edge2;
            this.drawSplitLine(p1, p2);

            // take control on slitter bar with mouseup and mouse move event
            var self = this;
            $(document).bind('mousemove', self._onMouseMove);
            $(document).bind('mouseup', self._onMouseEnd);
        }

        onMouseMove(evt: any) {
            //var props = this.props;
            var ctx = this.context;
            var newPos = evt[ctx.css.page] - ctx.offset;
            this.$splitter.css(ctx.css.origin, newPos);     // set splitter position 
        }

        onMouseEnd(evt: any) {
            ilog('mouseup at ' + evt.pageX + ',' + evt.pageY);

            // remove mouse events.
            var self = this;
            $(document).unbind('mousemove', self._onMouseMove);
            $(document).unbind('mouseup', self._onMouseEnd);

            var ctx = this.context, r = this.bound;
            var at = this.coordinateAt(evt.pageX, evt.pageY);

            this.$splitter.remove();
            this.$splitter = null;

            try {
                if (ctx.mode == 'split') this.splitChildAt(at, ctx.isHorz, ctx.full);
                else if (ctx.mode == 'pull') this.pullChildsTo(at, ctx.full);
            }
            finally {
                this.context = null;
            }
        }
        /**
         * add/draw splitter bar
         */
        drawSplitLine(p1: Point, p2: Point) {
            if (!p1 || !p2) throw 'cant draw split line: p1/p2 is null';

            ilog('draw split. from=' + p1.description + ', to=' + p2.description);
            this.$splitter = $('<div class="mzi-split-bar"></div>');

            var w = Math.max(gripWidth, Math.abs(p2.x - p1.x));   // slpitter bar width
            var h = Math.max(gripHeight, Math.abs(p2.y - p1.y));  // splitter bar height

            this.$splitter.css({
                top: p1.y, left: p1.x, width: w, height: h,
                "z-index": 999999
            }).addClass(this.context.css.barClass);
            this.$splitter.appendTo(this.$wrapper);
        }
        /**
         * add bar for splitting. 
         * Set splitter bar edges for the closest(=1) panel to point on the edge of mesh.
         */
        setSplitMode(isHorz: boolean, at: Point, full?: boolean) {
            var ctx = this.context;
            if (ctx == null) throw 'set pull mode with null context';
            if (ctx.mode != 'split') throw 'set split with bad context mode ' + this.context.mode;

            var founds = this.getClosestPanels(isHorz, at);
            if (founds.length != 1) throw 'fail find panel on edge mesh';

            var p1: Point, p2: Point;
            var uid = founds[0], panel = this.childs[uid], r = panel.bound;
            if (full) r = this.bound;   // full mesh line

            if (isHorz) { p1 = new Point(r.left, at.y); p2 = new Point(r.right, at.y); }
            else { p1 = new Point(at.x, r.top); p2 = new Point(at.x, r.bottom); }

            this.context.edge1 = p1;
            this.context.edge2 = p2;
        }
		/**
		 * calculating spliiter line to resize/remove panels
		 */
        setPullMode(isHorz: boolean, at: Point, full?: boolean) {
            var ctx = this.context;
            if (ctx == null) throw 'set pull mode with null context';
            if (ctx.mode != 'pull') throw 'set pull with bad context mode ' + this.context.mode;

            var p1: number, p2: number;
            var edge1: Point, edge2: Point;
            var r = this.bound;
            if (isHorz) {
                p1 = full ? r.left : this.getSplitLine(isHorz, at, 'left');      // search cross from left
                p2 = full ? r.right : this.getSplitLine(isHorz, at, 'right');     // search cross from right

                edge1 = new Point(p1, at.y);
                edge2 = new Point(p2, at.y);
            }
            else {
                p1 = full ? r.top : this.getSplitLine(isHorz, at, 'top');      // search cross from top 
                p2 = full ? r.bottom : this.getSplitLine(isHorz, at, 'bottom');   // search cross from bottom 

                edge1 = new Point(at.x, p1);
                edge2 = new Point(at.x, p2);
            }
            this.context.edge1 = edge1;
            this.context.edge2 = edge2;
        }
		/**
		 * split the child located at the given point 
	     */
        splitChildAt(pt: Point, isHorz: boolean, full?: boolean) {
            var panel = this.findPanelAt(pt);
            if (panel == null) throw 'oop....didnt find';

            if (full) {
                var fromEdge: string;
                var line = isHorz ? pt.y : pt.x;
                var c = this.context;
                if (isHorz) fromEdge = this.overlay(c.dragFrom.y, 0) ? 'top' : 'bottom';
                else fromEdge = this.overlay(c.dragFrom.x, 0) ? 'left' : 'right';
                this.applyEdges(isHorz, line, fromEdge);

                return;
            }


            var r1 = panel.bound;
            var at0 = this.round2GridAt(isHorz, pt);
            var at = new Point(at0.x - r1.x, at0.y - r1.y);

            ilog('split ' + (isHorz ? 'horizontal' : 'vertival') + ' child at ' + at.description +
                ' for ' + panel.description);

            var sz1 = panel.bound.size, sz2 = sz1.clone();   // sz for panel1, and sz2 for panel2
            if (isHorz) { sz2.h = sz1.h - at.y; sz1.h -= sz2.h; }
            else { sz2.w = sz1.w - at.x; sz1.w -= sz2.w; }

            var minWH = minWidthHeight;
            if (sz1.w >= minWH && sz1.h >= minWH && sz2.w >= minWH && sz2.h >= minWH) {
                var r1 = panel.bound, r2 = r1.clone();

                if (isHorz) r2.y += sz1.h;
                else r2.x += sz1.w;

                r1.size = sz1; r2.size = sz2;

                // for split mode
                if (isHorz) { panel.bound = r1; this.add(new MziPanel(r2)); }
                else { panel.bound = r2; this.add(new MziPanel(r1)); }
            }
        }
        /** 
         * pull line to point
         */
        pullChildsTo(to: Point, full?: boolean) {
            var ctx = this.context;
            var isHorz = ctx.isHorz;
            var dragFrom = ctx.isHorz ? ctx.dragFrom.y : ctx.dragFrom.x;
            var dragTo = ctx.isHorz ? to.y : to.x;
            var edge1 = ctx.isHorz ? ctx.edge1.x : ctx.edge1.y;
            var edge2 = ctx.isHorz ? ctx.edge2.x : ctx.edge2.y;


            if (full) {
                var r = this.bound;
                if (isHorz) { edge1 = r.left; edge2 = r.right; }
                else { edge1 = r.top; edge2 = r.bottom; }
            }


            this.doPullChilds(isHorz, dragFrom, dragTo, edge1, edge2);
        }
        /** 
         * pull line from/to and remove if found only 1 panel to removed by pulled line. 
         */
        doPullChilds(isHorz: boolean, dragFrom: number, dragTo: number, edge1: number, edge2: number) {
            var overlapping = this.getOverlappedPanels(isHorz, dragFrom, edge1, edge2);
			
            // try rounding to any rect edge
            dragTo = this.round2Grid(isHorz, dragTo);
            dragFrom = this.round2Grid(isHorz, dragFrom);
            edge1 = this.round2Grid(isHorz, edge1);
            edge2 = this.round2Grid(isHorz, edge2);

            var uid2del: string[] = [];
            var dir = (dragTo - dragFrom) / (Math.abs(dragTo - dragFrom));   // -1 = right to left OR bottom to up 

            var to = dragTo;
            var minmax = dragTo - dragFrom > 0 ? 'min' : 'max';   // minimal/maximum target drag line 

            // find minimal "to" line allowed to drag to. considering all overlapping rectangles.
            for (var i in overlapping) {
                var uid = overlapping[i];
                var panel = this.childs[uid], r = panel.bound;

                // calculating minimal/maximum "to" considering minWidthHeight of panel
                var adjustedTo = this.adjustPull(isHorz, r, dragFrom, dragTo);
                var diff = Math.abs(adjustedTo - dragTo);   // check for removing    
				
                if (diff >= minWidthHeight) {
                    var del = false;

                    // allow remove only if current panel full overlap split line. 
                    // FIXME: add to a function
                    if (isHorz && r.left == edge1 && r.right == edge2) del = true;
                    if (!isHorz && r.top == edge1 && r.bottom == edge2) del = true;

                    if (del) {
                        if (uid2del.length == 0) adjustedTo += dir * minWidthHeight;   // adjust to rectangle edge
                        uid2del.push(uid);    // if > 1 we will not remove any panel.
                    }
                }
                else if (diff > 0 && diff < minWidthHeight) adjustedTo = dir * minWidthHeight;
                else { /* nothing to do .   adjusted is like to */ }

                to = Math[minmax](to, adjustedTo);
            }

            if (uid2del.length == 1) {   // remove only 1 full overlapped panel 
                var idx = overlapping.indexOf(uid2del[0]);
                overlapping.splice(idx, 1);
                var uid = uid2del[0];
                this.remove(this.childs[uid]);
            }

            // now do the resizing for the rest
            for (var i in overlapping) {
                var uid = overlapping[i];
                var panel = this.childs[uid], r = panel.bound;
                var pulled = this.pullPanel(isHorz, panel, dragFrom, to);
            }
        }
		/**
		 * add/modify panels from layout (key=uid, value=rect)
		 */
        applyRects(layout: any) {
            for (var uid in layout) {
                var rect = layout[uid];
                if (this.childs[uid] == null) new MziPanel(rect);
                else this.childs[uid].bound = rect;
            }
        }
		/**
		 * 
		 */
        pullPanel(isHorz: boolean, panel: MziPanel, from: number, to: number) {
            ilog('pull ' + panel.description + ' from:' + from + ' to:' + to);

            var overlay = this.overlay;
            var r = panel.bound;

            if (isHorz) {
                var top = r.top, bottom = r.bottom;
                if (from < bottom) top -= from - to; else bottom -= from - to;
                r.y = top; r.h = bottom - top;
            }
            else {
                var left = r.left, right = r.right;
                if (from < right) left -= from - to; else right -= from - to;
                r.x = left; r.w = right - left;
            }

            ilog('pulled ' + panel.guid + ', new rect ' + r.description);
            panel.bound = r;
        }
		/**
		 * calc "to" line minimum.  or return null if need to remove panel
		 */
        adjustPull(isHorz: boolean, r: Rectangle, from: number, to: number): number {
            var mwh = minWidthHeight;
            this.assertOnRectEdge(isHorz, r, from);
            if (isHorz) return from == r.bottom ? Math.max(r.top + mwh, to) : Math.min(r.bottom - mwh, to);
            else return from == r.right ? Math.max(r.left + mwh, to) : Math.min(r.right - mwh, to);
        }
		/** 
		 * ensre line is on one of the rectangle edges
		 */
        assertOnRectEdge(isHorz: boolean, rect: Rectangle, line: number) {
            if (isHorz && line != rect.top && line != rect.bottom) throw 'oops  line not on top/bottom';
            if (!isHorz && line != rect.left && line != rect.right) throw 'oops  line not on right/left';
        }
        /**
         * find a panel at a given point 
         * @return     null=not found
         */
        findPanelAt(pt: Point): MziPanel {
            for (var uid in this.childs) {
                var panel = this.childs[uid];
                if (panel.bound.contains(pt)) return panel;
            }
            return null;
        }
		/** 
		 * display mesh info 
		 */
        public get description(): string {
            var r = this.bound;
            var s = '*Mesh#' + this.guid + ', bound=' + this.bound.description;
            if (this.childs == 0) return s;
            var n = 0;
            for (var uid in this.childs) {
                var panel = this.childs[uid];
                s += ('\r\n\t' + panel.description);
                n++;
            }
            return s;
        }
		/** 
		 * count overlapped panels around a point
		 * 0    no panels 
		 * 1    point is on mesh edge 
	     * 2    from both side of point (up/down or left/right)
		 * > 2  error.  
         *
         * @isHorz    true=above and beneath, false=right and left 
         * @at        at point
         * @return    list of closest panels uid 
		 */
        getClosestPanels(isHorz: boolean, at: Point): string[] {
            var pt1 = at.clone(), pt2 = at.clone();
            var delta = 8;   // add pixels from left/right or above/beneath

            if (isHorz) { pt1.y -= delta; pt2.y += delta; }  // pt1: above, pt2: beneath
            else { pt1.x -= delta; pt2.x += delta; }  // pt1: left,  pt2: right
			
            var found: string[] = [];
            for (var uid in this.childs) {
                var panel = this.childs[uid], rect = panel.bound;
                if (rect.contains(pt1) || rect.contains(pt2)) found.push(uid);
            }

            if (found.length > 2) throw 'too many overlays (>2) : ' + found.length;
            if (found.length == 2 && found[0] == found[1]) found = [];    // point not on edge line.  so overlay is the same.

            return found;
        }
		/**
		 * calc slpitter edges where min/max crossing or meet mesh edge 
		 */
        getSplitLine(isHorz: boolean, at: Point, edge: string): number {
            var current = at.clone(), cross = null;
            var founds: string[];
            var overlay: Function = this.overlay;
            var delta = 4;

            var algoFind = {  // algorithm  searching crossing edges
                top: { delta: -delta, xy: 'y', minmax: 'max' },
                bottom: { delta: delta, xy: 'y', minmax: 'min' },
                left: { delta: delta, xy: 'x', minmax: 'min' },
                right: { delta: -delta, xy: 'x', minmax: 'max' },
            }

            var algo = algoFind[edge];

            do {
                var founds = this.getClosestPanels(isHorz, current);
                if (founds.length == 0) return null;  // not on split line.
                if (founds.length != 2) throw 'oops...bad get splitline count ' + founds.length;

                var panel1 = this.childs[founds[0]], panel2 = this.childs[founds[1]];
                var p1 = panel1.bound[edge], p2 = panel2.bound[edge];

                if (overlay(p1, p2)) cross = p1;   // check if both panel rely on given edge
                else current[algo.xy] = Math[algo.minmax](p1, p2) + algo.delta;   // next point to test
            } while (cross == null);

            return cross;
        }
		/**
		 * check if point on line.
		 */
        overlay(line: number, at: number, offset: number = 8): boolean {
            var p1 = at + offset, p2 = at - offset;
            return line < p1 && line > p2;
        }	
		/**
		 * rounding point to exists splitter line
	     */
        round2Grid(isHorz: boolean, line: number): number {
            var overlay = this.overlay;
            var offset = 10;
            for (var uid in this.childs) {
                var panel = this.childs[uid], r = panel.bound;
                if (isHorz && overlay(line, r.top, offset)) return r.top;
                if (isHorz && overlay(line, r.bottom, offset)) return r.bottom;
                if (!isHorz && overlay(line, r.left, offset)) return r.left;
                if (!isHorz && overlay(line, r.right, offset)) return r.right;
            }
            return line;
        }
		/** 
		 * normalize point nearest panel edge
		 */
        round2GridAt(isHorz: boolean, at: Point): Point {
            if (isHorz) at.y = this.round2Grid(isHorz, at.y);
            else at.x = this.round2Grid(isHorz, at.x);
            return at;
        }
		/**
		 * collect all panels around actual pull line
		 */
        getOverlappedPanels(isHorz: boolean, line: number, from: number, to: number): string[] {
            var overlay = this.overlay;

            var uidList: string[] = [];
            for (var uid in this.childs) {
                var panel = this.childs[uid], r = panel.bound;

                if (isHorz) {
                    if (r.left < from || r.right > to) continue;
                    if (overlay(line, r.top) || overlay(line, r.bottom))
                        uidList.push(uid);
                }
                else {
                    if (r.top < from || r.bottom > to) continue;
                    if (overlay(line, r.left) || overlay(line, r.right))
                        uidList.push(uid);
                }
            }
            return uidList;

        }
        /** normalize to mesh coordination **/
        coordinateAt(x: number, y: number): Point {
            return new Point(x - this.bound.x, y - this.bound.y);
        }
        /** 
         * for debug/testing use: check crossing rectangles 
         */
        testRects() {
        }

        /**
         * shrink rectangles with xx%
         */
        applyEdges(isHorz: boolean, to: number, fromEdge: string) {

            var algo = {
                top: { startAt: 'bottom', size: 'h', xy: 'y', sort: -1, dir: -1 },
                bottom: { startAt: 'top', size: 'h', xy: 'y', sort: 1, dir: 1 },
                left: { startAt: 'right', size: 'w', xy: 'x', sort: -1, dir: -1 },
                right: { startAt: 'left', size: 'w', xy: 'x', sort: 1, dir: 1 }
            }
            var a = algo[fromEdge];
            var rmesh = this.bound;
            to = this.adjustPull(isHorz, rmesh, rmesh[fromEdge], to);


            var pct = (to - rmesh[fromEdge]) / rmesh[a.size];

            var panels: Panel[] = [];
            for (var uid in this.childs) panels.push(this.childs[uid]);
            panels = sortPanels(panels, a.startAt, a.sort);
            var current;

            this.stashedContext = this.context;
            var ctx = this.context = {
                mode: 'pull',
                isHorz: isHorz,
                dragFrom: null,
                css: this.stashedContext.css,
                offset: this.stashedContext.offset,
                full: this.stashedContext.full
            }

            var panel: Panel;
            for (var i = 0; i < panels.length; i++) {
                panel = panels[i];
                var r = panel.bound;
                var line = r[fromEdge] + pct * r[a.size];
                var adjustedLine = this.adjustPull(isHorz, r, r[fromEdge], line);

                if (a.dir * adjustedLine >= a.dir * to) break;
                if (a.dir * adjustedLine < a.dir * current) continue;

                current = adjustedLine;
                var at = r.center; at[a.xy] = adjustedLine;
                var from = at.clone(); from[a.xy] = r[fromEdge];
                this.context.dragFrom = from;
                this.setPullMode(isHorz, this.context.dragFrom, true);
                this.pullChildsTo(at, this.context.full);
            }

            var at = rmesh.center; at[a.xy] = rmesh[fromEdge];
            this.context.dragFrom = at.clone();
            this.setPullMode(isHorz, this.context.dragFrom, true);
            at[a.xy] = to;
            this.pullChildsTo(at, this.context.full);

            at = this.round2GridAt(isHorz, at);

            var rect = this.bound.clone();
            var panel = panels[0];

            if (isHorz) {
                if (fromEdge == 'bottom') { rect.y = at.y; rect.h = rmesh.bottom - at.y }
                if (fromEdge == 'top') { rect.h = at.y }
            }
            else {
                if (fromEdge == 'right') { rect.x = at.x; rect.w = rmesh.right - at.x }
                if (fromEdge == 'left') { rect.w = at.x }
            }
            this.add(new MziPanel(rect));
        }
    }

    function sortPanels(array: Panel[], edge: string, sortFactor: number) {
        var compare = (a: Panel, b: Panel) => {
            var p1 = a.bound[edge], p2 = b.bound[edge];
            if (p2 > p1) return -sortFactor;
            if (p2 < p1) return sortFactor;
            return 0;
        };
        var result = array.sort(compare);
        return result;
    }
      
    /////////////////////////////////////////////////////////////////////////////////////

    /** A unique id */
    export function Guid(): string {
        var guidTmpl = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx';
        var callback = (c) => {
            var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        };
        return guidTmpl.replace(/[xy]/g, callback);
    }

    export var DEBUG = true;
    export var __dbg: any = {
        msg: null,
        pageX: 0, pageY: 0,
        splitoffset: 0
    };
    var $windbg: JQuery;

    export function initDEBUG() {
        $windbg = $('<div class="mzi-debug"></div>').appendTo($('body'));
        //        setInterval(printDEBUG, 10);
    }

    export function printDEBUG() {
        var content = '';

        content += '<b>msg:</b> ' + __dbg.msg + '<br/>';
        content += '<b>page:</b> ' + __dbg.pageX + ',' + __dbg.pageY + '<br/>';
        content += '<b>splitoffset</b>  ' + __dbg.splitoffset + '<br/>';

        $windbg.html(content);
    }

}

/////////////////////////////////////////////////////////////////////////////////////
// Graphics
/////////////////////////////////////////////////////////////////////////////////////
// point	
class Point {
    x: number;
    y: number;

    constructor(x?: number, y?: number) {
        this.x = x; this.y = y;
    }

    clone(): Point {
        return new Point(this.x, this.y);
    }

    public serialize(): string {
        return JSON.stringify({ type: "Point", x: this.x, y: this.y });
    }

    public get description(): string {
        return '*Point:' + this.x + ',' + this.y;
    }
}
// size 
class Size {
    w: number;
    h: number;

    constructor(w?: number, h?: number) {
        this.w = w; this.h = h;
    }

    clone(): Size {
        return new Size(this.w, this.h);
    }

    public serialize(): string {
        return JSON.stringify({ type: "Size", w: this.w, h: this.h });
    }

    public get description(): string {
        return '*Size:' + this.w + ',' + this.h;
    }
}
// rectangle
class Rectangle {
    x: number;
    y: number;
    w: number;
    h: number;

    constructor(x: number, y: number, w: number, h: number) {
        this.x = x; this.y = y;
        this.w = w; this.h = h;
    }
    //

    /** empty rectangle 0,0,0,0 **/
    public static empty(): Rectangle {
        return new Rectangle(0, 0, 0, 0);
    }

    clone(): Rectangle {
        return new Rectangle(this.x, this.y, this.w, this.h);
    }


    /** check if point is in bounds rectangle **/
    contains(pt: Point) {
        var isContains = pt.x > this.x && pt.x < this.x + this.w &&
            pt.y > this.y && pt.y < this.y + this.h;
        return isContains;
    }

    public get size(): Size { return new Size(this.w, this.h); }
    public set size(sz: Size) { this.w = sz.w; this.h = sz.h; }

    public get left(): number { return this.x; }
    public get right(): number { return this.x + this.w; }
    public get top(): number { return this.y; }
    public get bottom(): number { return this.y + this.h; }

    public get center(): Point {
        var x = Math.floor((this.right - this.left) / 2);
        var y = Math.floor((this.bottom - this.top) / 2);
        return new Point(x, y);
    }


    serialize(): string {
        return JSON.stringify({ type: 'Rectangle', x: this.x, y: this.y, w: this.w, h: this.h });
    }

    public get description(): string {
        return '*Rectangle:' + this.x + ',' + this.y + '^' + this.w + ',' + this.h;
    }
}
