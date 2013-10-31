/**************************************************
 ESRI Mapping Application Framework Library
**************************************************/
Ext.define("ca.esri.core.Geocoder", {
    extend: "Ext.panel.Panel",
    id: "GeocoderPanel",
    renderTo: "Core_Map",
    height: 30,
    width: 275,
    shadow: false,
    border: false,
    style: {
        background: "transparent"
    },
    trigger: null,
    loadMask: null,
    mapResizeHandler: null,
    initComponent: function () {
        this.callParent(arguments);
        this.trigger = Ext.create("Ext.form.field.Trigger", {
            id: "GeocoderTrigger",
            wcagTitle: app.locale.i18n("GeocoderTitle"),
            triggerCls: "geocoder-trigger",
            emptyText: app.locale.i18n("GeocoderTooltip"),
            width: 275,
            minLength: 3,
            regex: /^[a-zA-Z0-9àâçéèêëîïôûùüÿñæœ\.\-\s\&\,]*$/,
            onTriggerClick: Ext.Function.bind(this.onTriggerClick, this),
            listeners: {
                specialkey: function (c, b) {
                    if (b.getKey() === b.RETURN || b.getKey() === b.ENTER) {
                        this.trigger.onTriggerClick(b)
                    }
                },
                scope: this
            }
        });
        this.add(this.trigger);
        this.locator = new esri.tasks.Locator("http://tasks.arcgis.com/ArcGIS/rest/services/WorldLocator/GeocodeServer");
        this.locatorOnAddressToLocationsCompleteHandler = dojo.connect(this.locator, "onAddressToLocationsComplete", this, this.cbAddressToLocationsComplete);
        this.on("afterrender", this.onAfterRender)
    },
    onAfterRender: function (c, b) {
        this.mapResizeHandler = dojo.connect(app.map, "resize", app.map, function (d) {
            c.alignTo(Ext.getCmp("Core_Map"), "tr-tr", [-5, 5])
        });
        c.alignTo(Ext.getCmp("Core_Map"), "tr-tr", [-5, 5]);
        this.un("afterrender", this.onAfterRender)
    },
    onTriggerClick: function (b) {
        this.trigger.setValue(this.trigger.getValue().replace(/^\s+|\s+$/g, ""));
        if (this.trigger.getValue().length < this.trigger.minLength) {
            return
        }
        var c = {
            address: {
                SingleLine: this.trigger.getValue(),
                Country: "Canada"
            },
            searchExtent: app.initExtent,
            outFields: ["Loc_name"]
        };
        this.locator.outSpatialReference = app.map.spatialReference;
        this.locator.addressToLocations(c);
        if (this.loadMask === null) {
            this.loadMask = new Ext.LoadMask(this.trigger, {
                msg: app.locale.i18n("GeocoderMask")
            })
        }
        this.loadMask.show()
    },
    cbAddressToLocationsComplete: function (b) {
        this.loadMask.hide();
        if (b && b.length > 0 && b[0].location && b[0].score > 97.9) {
            var d = new esri.geometry.Point(b[0].location.x, b[0].location.y, app.map.spatialReference);
            if (app.initExtent.contains(d)) {
                var c = app.map.toScreen(d);
                app.map.centerAndZoom(d, 9)
            } else {
                this.showNoResultsMsg()
            }
        } else {
            this.showNoResultsMsg()
        }
    },
    showNoResultsMsg: function () {
        Ext.Msg.show({
            title: this.trigger.getValue(),
            msg: Ext.String.format(app.locale.i18n("GeocoderNoResults"), this.trigger.getValue()),
            buttons: Ext.Msg.OK,
            fn: function () {
                this.trigger.selectText()
            },
            icon: Ext.window.MessageBox.INFO,
            scope: this
        })
    },
    destroy: function () {
        dojo.disconnect(this.mapResizeHandler);
        this.mapResizeHandler.remove();
        this.mapResizeHandler = null;
        if (this.trigger != null) {
            this.trigger.destroy();
            this.trigger = null
        }
        this.callParent(arguments)
    }
});
Ext.define("ca.esri.core.Locale", {
    extend: "Ext.util.HashMap",
    i18n: null,
    constructor: function (b) {
        this.initConfig(b);
        this.callParent([b]);
        this.i18n = this.get;
        this.addStrings()
    },
    get: function (b) {
        var c = this.callParent(arguments);
        if (c === undefined) {
            return b
        }
        return c
    },
    addStrings: function () {}
});
Ext.define("ca.esri.core.MapClickManager", {
    extend: "Ext.util.Observable",
    config: {
        map: null
    },
    onClickHandler: null,
    onClickStack: {
        stack: [],
        pop: function () {
            return this.stack.pop()
        },
        push: function (d) {
            for (var c = 0; c < this.stack.length; c++) {
                if (this.stack[c].key === d.key) {
                    var b = this.stack.splice(c, 1)[0];
                    return this.stack.push(b)
                }
            }
            return this.stack.push(d)
        },
        peek: function () {
            return this.stack[this.stack.length - 1]
        },
        remove: function (c) {
            for (var b = 0; b < this.stack.length; b++) {
                if (this.stack[b].key === c) {
                    this.stack.splice(b, 1);
                    return true
                }
            }
            return false
        }
    },
    constructor: function (b) {
        this.initConfig(b);
        this.addEvents({
            mapClickRegistered: true
        });
        if (typeof b === "undefined" || typeof b.map === "undefined") {
            this.map = app.map
        }
        dojo.connect(this.map, "onLayerAdd", dojo.hitch(this, function (c) {
            if (c instanceof esri.layers.GraphicsLayer) {
                if (this.onClickStack.peek()) {
                    this.disableAllGraphicsLayers()
                } else {
                    this.enableAllGraphicsLayers()
                }
            }
        }));
        this.callParent(arguments)
    },
    setHandler: function (c, b, e) {
        var d = null;
        if (e) {
            d = function () {
                return b.apply(e, arguments)
            }
        } else {
            d = b
        }
        this.disableAllGraphicsLayers();
        this.onClickStack.push({
            key: c,
            value: d
        });
        if (this.onClickHandler) {
            this.onClickHandler.remove()
        }
        this.onClickHandler = dojo.connect(this.map, "onClick", d);
        this.fireEvent("mapClickRegistered", {
            key: c,
            value: d
        })
    },
    unsetHandler: function (b) {
        if (this.onClickStack.remove(b)) {
            if (this.onClickHandler) {
                this.onClickHandler.remove();
                this.onClickHandler = null
            }
            if (this.onClickStack.peek()) {
                this.onClickHandler = dojo.connect(this.map, "onClick", this.onClickStack.peek().value);
                this.fireEvent("mapClickRegistered", this.onClickStack.peek())
            } else {
                this.fireEvent("mapClickRegistered", "empty");
                this.enableAllGraphicsLayers()
            }
        }
    },
    isCurrentHandler: function (b) {
        if (this.onClickStack.peek()) {
            return this.onClickStack.peek().key === b
        }
        return false
    },
    enableAllGraphicsLayers: function () {
        Ext.each(this.map.graphicsLayerIds, function (b) {
            this.map.getLayer(b).enableMouseEvents()
        }, this)
    },
    disableAllGraphicsLayers: function () {
        Ext.each(this.map.graphicsLayerIds, function (b) {
            this.map.getLayer(b).disableMouseEvents()
        }, this)
    }
});
Ext.define("ca.esri.core.MetadataTranslator", {
    config: {
        locale: null
    },
    metadataService: {
        en: "atlas/metadata",
        fr: "atlas/metadonnees"
    },
    errorCodes: {
        UNKNOWN: 0,
        CANTCONNECTSOE: 1,
        INVALIDMETADATA: 2
    },
    constructor: function (b) {
        this.initConfig(b);
        if (typeof b === "undefined" || typeof b.locale === "undefined") {
            this.locale = dojo.locale
        }
    },
    getTranslatedUrl: function (d, h, c) {
        if (typeof c !== "function") {
            c = function () {}
        }
        if (typeof h !== "function") {
            alert("you must set the success function");
            return
        }
        var g = /^(.*)\/([^\/\n]+)$/.exec(d);
        if (g === null || g.length !== 3) {
            c(new Ext.Error({
                msg: "Couldn't contact metadata SOE",
                errorCode: this.errorCodes.CANTCONNECTSOE
            }));
            return
        }
        var f = g[1];
        var b = g[2];
        var e = f + "/exts/MetadataSoe/" + b;
        this.parseIdFromMetadata(e, h, c)
    },
    parseIdFromMetadata: function (d, e, b) {
        var c = "";
        if (this.locale === "fr") {
            c = "French Metadata UID"
        } else {
            c = "English Metadata UID"
        }
        Ext.Ajax.request({
            url: d,
            callback: function (j, g, h) {
                if (g === false) {
                    b(new Ext.Error({
                        msg: "Couldn't contact metadata SOE",
                        errorCode: this.errorCodes.CANTCONNECTSOE
                    }));
                    return
                }
                var m = h.responseXML;
                var f = Ext.DomQuery.select("distTranOps onLineSrc", m);
                var o = null;
                for (var k = 0; k < f.length; k++) {
                    if (Ext.DomQuery.selectValue("orName", f[k]) === c) {
                        o = Ext.DomQuery.selectValue("orDesc", f[k])
                    }
                }
                if (o === null) {
                    b(new Ext.Error({
                        msg: "Coudln't parse out geoportalID",
                        errorCode: this.errorCodes.INVALIDMETADATA
                    }));
                    return
                }
                var n = /\{([^{]+)\}/.exec(o);
                if (n !== null && n.length === 2) {
                    o = n[1]
                }
                e("/" + this.metadataService[this.locale] + "/" + o)
            },
            scope: this
        })
    }
});
Ext.define("ca.esri.core.Notice", {
    msgCt: null,
    hideDelay: 1000,
    anchor: null,
    position: "t-t",
    constructor: function (b) {
        Ext.util.CSS.createStyleSheet(".msg .x-box-mc {    font-size: 14px;}#msg-div { z-index: 10000000000;  left: 40%;    position: absolute;    top: 310px;    width: 20%; min-width: 250px;}", "notice");
        Ext.apply(this, b)
    },
    createBox: function (b, c) {
        return ['<div class="msg">', '<div class="x-box-tl"><div class="x-box-tr"><div class="x-box-tc"></div></div></div>', '<div class="x-box-ml"><div class="x-box-mr"><div class="x-box-mc"><h3>', b, "</h3>", c, "</div></div></div>", '<div class="x-box-bl"><div class="x-box-br"><div class="x-box-bc"></div></div></div>', "</div>"].join("")
    },
    msg: function (e, d) {
        if (!this.msgCt) {
            this.msgCt = Ext.DomHelper.insertFirst(document.body, {
                id: "msg-div"
            }, true)
        }
        if (this.anchor) {
            this.msgCt.alignTo(this.anchor, this.position)
        }
        var c = d;
        var b = Ext.DomHelper.append(this.msgCt, {
            html: this.createBox(e, c)
        }, true);
        b.slideIn("t").pause(this.hideDelay).ghost("t", {
            remove: true
        })
    }
});
Ext.define("ca.esri.core.esrimodel.mapservice.Layers", {
    extend: "Ext.data.Model",
    fields: [{
        name: "id",
        type: "int"
    }, {
        name: "name",
        type: "string"
    }, {
        name: "parentLayerId",
        type: "int"
    }, {
        name: "defaultVisibility",
        type: "boolean"
    }, {
        name: "subLayerIds",
        type: "string"
    }, {
        name: "minScale",
        type: "float"
    }, {
        name: "maxScale",
        type: "float"
    }]
});
Ext.define("ca.esri.core.esrimodel.mapservicelayer.Fields", {
    extend: "Ext.data.Model",
    fields: [{
        name: "name",
        type: "string"
    }, {
        name: "type",
        type: "string"
    }, {
        name: "alias",
        type: "string"
    }, {
        name: "length",
        type: "int"
    }, {
        name: "domain",
        type: "string"
    }]
});
Ext.define("Ext.override.data.TreeStore", {
    override: "Ext.data.TreeStore",
    findByRawValue: function (g, c, h) {
        if (g == null) {
            return null
        }
        var f;
        var e = g.childNodes;
        for (var d = 0, b = e.length; d < b; d++) {
            if (e[d].raw[c] === h) {
                return e[d]
            } else {
                f = this.findByRawValue(e[d], c, h);
                if (f) {
                    return f
                }
            }
        }
        return null
    }
});
Ext.define("Ext.override.form.field.Base", {
    override: "Ext.form.field.Base",
    onRender: function () {
        this.callParent(arguments);
        var b = this.getEl().dom.getElementsByTagName("input");
        if (b.length > 0) {
            if (!b[0].getAttribute("title")) {
                if (this.wcagTitle) {
                    b[0].setAttribute("title", this.wcagTitle)
                } else {
                    if (!this.boxLabel) {
                        console.log("not setting title");
                        console.log(b[0])
                    }
                }
            } else {
                console.log("title already set: " + b[0].getAttribute("title"))
            }
        }
    },
    labelableRenderTpl: ['<tr id="{id}-inputRow" <tpl if="inFormLayout">id="{id}"</tpl>>', '<tpl if="labelOnLeft">', '<td id="{id}-labelCell" style="{labelCellStyle}" {labelCellAttrs}>', "{beforeLabelTpl}", '<{[values.$comp.getSubTplData().boxLabel ? \'span\': \'label\']} id="{id}-labelEl" {labelAttrTpl}<tpl if="inputId"> for="{inputId}"</tpl> class="{labelCls}"', '<tpl if="labelStyle"> style="{labelStyle}"</tpl>>', "{beforeLabelTextTpl}", '<tpl if="fieldLabel">{fieldLabel}{labelSeparator}</tpl>', "{afterLabelTextTpl}", "</{[values.$comp.getSubTplData().boxLabel ? 'span': 'label']}>", "{afterLabelTpl}", "</td>", "</tpl>", '<td class="{baseBodyCls} {fieldBodyCls}" id="{id}-bodyEl" colspan="{bodyColspan}" role="presentation">', "{beforeBodyEl}", "<tpl if=\"labelAlign=='top'\">", "{beforeLabelTpl}", '<div id="{id}-labelCell" style="{labelCellStyle}">', '<label id="{id}-labelEl" {labelAttrTpl}<tpl if="inputId"> for="{inputId}"</tpl> class="{labelCls}"', '<tpl if="labelStyle"> style="{labelStyle}"</tpl>>', "{beforeLabelTextTpl}", '<tpl if="fieldLabel">{fieldLabel}{labelSeparator}</tpl>', "{afterLabelTextTpl}", "</label>", "</div>", "{afterLabelTpl}", "</tpl>", "{beforeSubTpl}", "{[values.$comp.getSubTplMarkup()]}", "{afterSubTpl}", "<tpl if=\"msgTarget==='side'\">", "{afterBodyEl}", "</td>", "<td id=\"{id}-sideErrorCell\" vAlign=\"{[values.labelAlign==='top' && !values.hideLabel ? 'bottom' : 'middle']}\" style=\"{[values.autoFitErrors ? 'display:none' : '']}\" width=\"{errorIconWidth}\">", '<div id="{id}-errorEl" class="{errorMsgCls}" style="display:none;width:{errorIconWidth}px"></div>', "</td>", "<tpl elseif=\"msgTarget=='under'\">", '<div id="{id}-errorEl" class="{errorMsgClass}" colspan="2" style="display:none"></div>', "{afterBodyEl}", "</td>", "</tpl>", "</tr>",
    {
        disableFormats: true
    }]
});
Ext.define("Ext.override.form.field.Text", {
    override: "Ext.form.field.Text",
    onFocus: function () {
        this.callParent(arguments);
        app.map.disableKeyboardNavigation();
        app.allowKeyMap4MouseEvts = false
    },
    postBlur: function () {
        this.callParent(arguments);
        app.map.enableKeyboardNavigation();
        app.allowKeyMap4MouseEvts = true
    }
});
Ext.define("Ext.override.panel.Tool", {
    override: "Ext.panel.Tool",
    wcagText: null,
    initComponent: function () {
        this.callParent();
        this.wcagText = "";
        switch (this.type) {
        case "help":
            this.wcagText = app.locale.i18n("HelpToolAltText");
            break;
        case "close":
            this.wcagText = app.locale.i18n("CloseToolAltText");
            break;
        default:
            if (this.type.indexOf("collapse") != -1) {
                this.wcagText = app.locale.i18n("CollapseToolAltText")
            }
            break
        }
    },
    afterRender: function () {
        this.callParent();
        this.toolEl.addListener("keyup", function (b, d, c) {
            if (b.keyCode == b.ENTER) {
                this.onClick(b, d)
            }
        }, this);
        this.toolEl.set({
            tabindex: 0,
            alt: this.wcagText,
            title: this.wcagText
        })
    }
});
Ext.define("Ext.override.tree.Column", {
    override: "Ext.tree.Column",
    imgText: '<img src="{1}" class="{0}" alt="" />',
    checkboxText: '<input type="button" role="checkbox" class="{0}" {1} tabindex="-1" />',
    treeRenderer: function (k, b, f, c, e, m, h) {
        var d = this.callParent(arguments);
        var g = d.lastIndexOf("/>");
        var j = d.substring(g + 2);
        d = d.replace('<input type="button"', ['<input type="button" title="', j, '"'].join(""));
        return d
    }
});
Ext.define("Ext.override.window.Window", {
    override: "Ext.window.Window",
    onShow: function () {
        this.callParent(arguments);
        Ext.Ajax.request({
            url: [app.CLIENT_ROOT, "?win=", this.$className, "&app=", app.$className].join(""),
            method: "HEAD"
        })
    }
});
Ext.define("Ext.ux.ColorField", {
    extend: "Ext.form.field.Trigger",
    alias: "widget.colorfield",
    requires: ["Ext.form.field.VTypes", "Ext.layout.component.field.Text"],
    lengthText: "Color hex values must be either 3 or 6 characters.",
    blankText: "Must have a hexidecimal value in the format ABCDEF.",
    regex: /^[0-9a-f]{3,6}$/i,
    validateValue: function (b) {
        if (this.allowBlank && !b) {
            return true
        }
        if (!this.getEl()) {
            return true
        }
        if (b.length != 3 && b.length != 6) {
            this.markInvalid(Ext.String.format(this.lengthText, b));
            return false
        }
        if ((b.length < 1 && !this.allowBlank) || !this.regex.test(b)) {
            this.markInvalid(Ext.String.format(this.blankText, b));
            return false
        }
        this.markInvalid();
        this.setColor(b);
        return true
    },
    markInvalid: function (b) {
        Ext.ux.ColorField.superclass.markInvalid.call(this, b);
        this.inputEl.setStyle({
            "background-image": "url(../resources/themes/images/default/grid/invalid_line.gif)"
        })
    },
    setValue: function (b) {
        Ext.ux.ColorField.superclass.setValue.call(this, b);
        this.setColor(b)
    },
    setColor: function (b) {
        Ext.ux.ColorField.superclass.setFieldStyle.call(this, {
            color: "#" + b,
            "background-color": "#" + b,
            "background-image": "none"
        })
    },
    menuListeners: {
        select: function (b, c) {
            this.setValue(c)
        },
        show: function () {
            this.onFocus()
        },
        hide: function () {
            this.focus();
            var b = this.menuListeners;
            this.menu.un("select", b.select, this);
            this.menu.un("show", b.show, this);
            this.menu.un("hide", b.hide, this)
        }
    },
    onTriggerClick: function (b) {
        if (this.disabled) {
            return
        }
        this.menu = new Ext.menu.ColorPicker({
            shadow: true,
            autoShow: true
        });
        this.menu.alignTo(this.inputEl, "tl-bl?");
        this.menu.doLayout();
        this.menu.on(Ext.apply({}, this.menuListeners, {
            scope: this
        }));
        this.menu.show(this.inputEl)
    }
});
Ext.define("ca.esri.core.task.identifyAllTask", {
    mixins: {
        observable: "Ext.util.Observable"
    },
    layerCustomIdentifierParameters: [],
    objDeferred: null,
    constructor: function (b) {
        this.mixins.observable.constructor.call(this, b);
        this.addEvents({
            complete: true,
            error: true,
            layerComplete: true,
            layerError: true
        })
    },
    execute: function (j, k, d) {
        var g = this;
        var h = [];
        this.objDeferred = new dojo.Deferred();
        var b = new esri.tasks.IdentifyParameters();
        b.layerOption = esri.tasks.IdentifyParameters.LAYER_OPTION_VISIBLE;
        b.tolerance = 3;
        b.returnGeometry = true;
        b.width = app.map.width;
        b.height = app.map.height;
        b.mapExtent = app.map.extent;
        b.geometry = j.geometry;
        var e = app.map.getLayersVisibleAtScale();
        arrIdParams = [];
        for (i in e) {
            if (e[i].includeInLayerList) {
                if (e[i].visible == false || e[i].visibleLayers[0] == -1) {
                    continue
                } else {
                    b.layerIds = e[i].visibleLayers
                }
                if (e[i].id in this.layerCustomIdentifierParameters) {
                    b.layerIds = this.layerCustomIdentifierParameters[e[i].id].layerIds
                }
                var c = Ext.create("ca.esri.core.task.identifyTask", e[i].url);
                var m = c.execute(b);
                h.push(m);
                m.addErrback(this.propogateError);
                m.then(function (n) {
                    var o = {
                        layerName: n[0].layerName,
                        status: "success",
                        message: "",
                        results: n
                    };
                    g.objDeferred.progress(o);
                    return n
                })
            }
        }
        var f = new dojo.DeferredList(h, false, false, true);
        f.then(function (n) {
            var o = [];
            for (i in n) {
                if (n[i][0] !== null && n[i][0] == true) {
                    o = o.concat(n[i][1])
                }
            }
            g.objDeferred.resolve(o);
            g.fireEvent("complete", o)
        });
        return this.objDeferred
    },
    propogateError: function (b) {
        var c = {
            layerName: "unknown",
            status: "error",
            message: b.message,
            results: []
        };
        this.objDeferred.progress(c);
        this.fireEvent("error", b)
    },
    setIdentifierParameters: function (c, b) {
        this.layerCustomIdentifierParameters[c] = b
    }
});
Ext.define("ca.esri.core.task.identifyTask", {
    mixins: {
        observable: "Ext.util.Observable"
    },
    url: null,
    layerCustomIdentifierParameter: null,
    objDeferred: null,
    constructor: function (b) {
        this.mixins.observable.constructor.call(this, {
            url: b
        });
        this.addEvents({
            complete: true,
            error: true
        })
    },
    execute: function (f, g, d) {
        var e = this;
        var b = new esri.tasks.IdentifyTask(this.url);
        var c = b.execute(f);
        if (d !== null) {
            c.addErrback(d)
        }
        if (g !== null) {
            c.addCallback(g)
        }
        c.then(function (h) {
            if (h.length == 0) {
                return h
            }
            return dojo.map(h, function (j) {
                var k = j.feature;
                k.attributes.layerName = j.layerName;
                var m = new esri.InfoTemplate(j.layerName + ": " + j.value, "${*}");
                k.setInfoTemplate(m);
                return j
            })
        }).then(function (h) {
            e.fireEvent("complete", h);
            return h
        });
        return c
    }
});
Ext.define("ca.esri.core.tool.ToolbarButton", {
    extend: "Ext.button.Button",
    side: "left",
    scale: "large",
    tooltipKey: null,
    tooltipType: "title",
    winLcl: null,
    winCfg: {},
    constructor: function (b) {
        if (this.winLcl != null) {
            Ext.create(this.winLcl + dojo.locale).addStrings();
            this.tooltip = app.locale.i18n(this.tooltipKey)
        }
        this.text = app.locale.i18n(this.textKey);
        this.initConfig(b);
        this.callParent([b])
    },
    initComponent: function () {
        if (this.tooltip === undefined) {
            alert(this.$className + ".constructor requires a tooltip be set in the config or class definition.");
            return
        }
        if (this.textKey === undefined) {
            alert(this.$className + ".constructor requires a valid textKey be set in the config or class definition.");
            return
        }
        this.callParent(arguments)
    },
    handler: function (c, b) {
        if (c.window === null || c.window === undefined) {
            c.window = Ext.create(this.winCls, this.winCfg);
            c.window.on("destroy", function (d) {
                this.window = null
            }, c)
        }
        c.window.show()
    }
});
Ext.define("ca.esri.core.tool.about.Window", {
    extend: "Ext.window.Window",
    id: "AboutWindow",
    constrainHeader: true,
    shadow: false,
    collapsible: true,
    bodyPadding: 7,
    margin: 3,
    defaults: {
        style: {
            margin: "3px"
        }
    },
    layout: "fit",
    width: 500,
    height: 400,
    tabPanel: null,
    urls: null,
    initComponent: function () {
        this.callParent(arguments);
        this.title = app.locale.i18n("AboutTitle");
        if (this.urls === undefined) {
            alert(this.$className + ".constructor requires an array of associative arrays with 'title' and 'href' values be passed in the config.");
            return
        }
        var c = [];
        for (var b = 0; b < this.urls.length; b++) {
            c.push({
                title: app.locale.i18n(this.urls[b].titleKey),
                html: ['<iframe src="', this.urls[b].url, '" title="', app.locale.i18n(this.urls[b].titleKey), '" frameborder="0" width="100%" height="100%" />'].join("")
            })
        }
        this.tabPanel = Ext.create("Ext.tab.Panel", {
            id: "AboutWindowTabPanel",
            layout: "fit",
            items: c,
            activeTab: 0
        });
        this.add(this.tabPanel)
    },
    destroy: function () {
        this.callParent(arguments)
    }
});
Ext.define("ca.esri.core.tool.about.locale.en", {
    addStrings: function () {
        app.locale.add("AboutText", "About");
        app.locale.add("AboutTooltip", "About this map");
        app.locale.add("AboutTitle", "About");
        app.locale.add("AboutCopyright", "Copyright");
        app.locale.add("AboutDisclaimer", "Disclaimer")
    }
});
Ext.define("ca.esri.core.tool.about.locale.fr", {
    addStrings: function () {
        app.locale.add("AboutText", "À propos");
        app.locale.add("AboutTooltip", "À propos de cette carte");
        app.locale.add("AboutTitle", "À propos");
        app.locale.add("AboutCopyright", "Droit d'auteur");
        app.locale.add("AboutDisclaimer", "Avis de non-responsabilité")
    }
});
dojo.require("esri.layers.wms");
dojo.require("esri.layers.FeatureLayer");
Ext.define("ca.esri.core.tool.addlayer.AddData", {
    config: {
        featureGeneratorUrl: "ArcgisPortalProxy/generateshapefile",
        identifyServiceUrl: "esrimapserviceinfo/ws/esrimapserviceinfo/getMapServiceInfo",
        wmsProxyUrl: "wmsproxy/ws/wmsproxy/executeFromProxy",
        map: null,
        success: function () {},
        failure: function () {}
    },
    errorCodes: {
        UNKNOWN: 0,
        IDENTIFYSERVICEDOWN: 1,
        IDENTIFYUNKNOWNTYPE: 2,
        UNSUPPORTEDTYPE: 3,
        PORTALPROXYDOWN: 4,
        ESRIPORTALERROR: 5,
        ADDLAYERFAILED: 6,
        ADDWMSLAYERFAILED: 7,
        WMSPROXYSERVICEDOWN: 8,
        SECUREDSERVICE: 9
    },
    addedServiceCounter: 0,
    layers: null,
    constructor: function (b) {
        this.initConfig(b);
        if (typeof b === "undefined" || typeof b.featureGeneratorUrl === "undefined") {
            this.featureGeneratorUrl = app.WL_DOMAIN + this.featureGeneratorUrl
        }
        if (typeof b === "undefined" || typeof b.identifyServiceUrl === "undefined") {
            this.identifyServiceUrl = app.WL_DOMAIN + this.identifyServiceUrl
        }
        if (typeof b === "undefined" || typeof b.wmsProxyUrl === "undefined") {
            this.wmsProxyUrl = app.WL_DOMAIN + this.wmsProxyUrl
        }
        if (typeof b === "undefined" || typeof b.map === "undefined") {
            this.map = app.map
        }
    },
    addMapService: function (d) {
        var c = Ext.String.trim(d);
        var b = this.identifyServiceUrl + "?addLayerInfo=true&url=" + c;
        Ext.data.JsonP.request({
            url: b,
            scope: this,
            callbackKey: "callback",
            callback: function (g, f) {
                if (f === null || typeof f.success === "undefined") {
                    this.failure(this.generateExtError("Identify service is down", this.errorCodes.IDENTIFYSERVICEDOWN));
                    return
                } else {
                    if (f.success === false) {
                        if (f.isSSL === true) {
                            this.failure(this.generateExtError("This service is secured", this.errorCodes.SECUREDSERVICE));
                            return
                        } else {
                            this.failure(this.generateExtError("Identify service couldn't identify type", this.errorCodes.IDENTIFYUNKNOWNTYPE));
                            return
                        }
                    } else {
                        if (f.serviceType === "ArcGISDynamicMapServiceLayer") {
                            this.addServiceToMap(new esri.layers.ArcGISDynamicMapServiceLayer(c))
                        } else {
                            if (f.serviceType === "ArcGISTiledMapServiceLayer") {
                                this.addServiceToMap(new esri.layers.ArcGISTiledMapServiceLayer(c))
                            } else {
                                if (f.serviceType === "FeatureLayer") {
                                    this.addServiceToMap(new esri.layers.FeatureLayer(c))
                                } else {
                                    if (f.serviceType === "FeatureService") {
                                        Ext.each(f.layerInfo.layers, function (h) {
                                            var j = c + "/" + h.id;
                                            this.addServiceToMap(new esri.layers.FeatureLayer(j))
                                        }, this)
                                    } else {
                                        if (f.serviceType === "ArcGISImageServiceLayer") {
                                            var e = new esri.layers.ImageServiceParameters();
                                            this.addServiceToMap(new esri.layers.ArcGISImageServiceLayer(c, {
                                                imageServiceParameters: e
                                            }))
                                        } else {
                                            this.failure(this.generateExtError("Unsupported service type", this.errorCodes.UNSUPPORTEDTYPE));
                                            return
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        })
    },
    addWms: function (b) {
        var c = this.wmsProxyUrl + "?remoteService=" + b + "&version=1.3.0&service=wms&request=GetCapabilities";
        Ext.Ajax.request({
            url: c,
            scope: this,
            success: function (e, f) {
                var d = new esri.layers.WMSLayer(c);
                dojo.connect(d, "onError", this, this.errorAddingLayer(d));
                d.includeInLegend = false;
                d.setImageFormat("png");
                this.addServiceToMap(d)
            },
            failure: function (d, e) {
                this.failure(this.generateExtError("WMS proxy service is down", this.errorCodes.WMSPROXYSERVICEDOWN))
            }
        })
    },
    addShp: function (g, d) {
        var c = esri.geometry.getExtentForScale(this.map, 40000);
        var b = c.getWidth() / this.map.width;
        var f = {
            name: g,
            targetSR: this.map.spatialReference,
            maxRecordCount: 1000,
            enforceInputFileSizeLimit: true,
            enforceOutputJsonSizeLimit: true
        };
        f.generalize = true;
        f.maxAllowableOffset = b;
        f.reducePrecision = true;
        f.numberOfDigitsAfterDecimal = 0;
        var e = {
            filetype: "shapefile",
            f: "json",
            publishParameters: dojo.toJson(f)
        };
        d.submit({
            url: this.featureGeneratorUrl,
            params: e,
            success: function (h, j) {
                this.addShapefileToMap(j, g)
            },
            failure: function (h, j) {
                this.addShapefileToMap(j, g)
            },
            scope: this
        })
    },
    getErrorAddingLayerMessage: function (c) {
        var b = "";
        switch (c.errorCode) {
        case this.errorCodes.IDENTIFYUNKNOWNTYPE:
        case this.errorCodes.UNSUPPORTEDTYPE:
        case this.errorCodes.ADDLAYERFAILED:
            b = app.locale.i18n("AddLayerErrorMapserviceUnsupported");
            break;
        case this.errorCodes.PORTALPROXYDOWN:
        case this.errorCodes.IDENTIFYSERVICEDOWN:
        case this.errorCodes.WMSPROXYSERVICEDOWN:
            b = app.locale.i18n("AddLayerErrorServiceDown");
            break;
        case this.errorCodes.ADDWMSLAYERFAILED:
            b = app.locale.i18n("AddLayerErrorInvalidWms");
            break;
        case this.errorCodes.ESRIPORTALERROR:
            b = this.parseEsriPortalError(c.msg);
            break;
        case this.errorCodes.SECUREDSERVICE:
            b = app.locale.i18n("AddLayerErrorSecuredLayer");
            break;
        case this.errorCodes.UNKNOWN:
            b = app.locale.i18n("AddLayerErrorUnknownError");
            break;
        default:
            b = app.locale.i18n("AddLayerErrorUnknownError")
        }
        return b
    },
    addServiceToMap: function (b) {
        this.addedServiceCounter++;
        dojo.connect(b, "onError", this, this.errorAddingLayer(b));
        if (b.loaded) {
            this.layerAdded(b)
        } else {
            dojo.connect(b, "onLoad", this, this.layerAdded)
        }
    },
    addShapefileToMap: function (e, j) {
        this.addedServiceCounter++;
        var b = Ext.JSON.decode(e.response.responseText, true);
        var g = null,
            f = [];
        if (b === null) {
            this.failure(this.generateExtError("The ArcGIS portal proxy service is down", this.errorCodes.PORTALPROXYDOWN));
            return
        } else {
            if (b.error) {
                this.failure(this.generateExtError(b.error.message, this.errorCodes.ESRIPORTALERROR));
                return
            } else {
                if (!b.featureCollection) {
                    this.failure(this.generateExtError("The ArcGIS portal proxy service is down", this.errorCodes.PORTALPROXYDOWN));
                    return
                } else {
                    g = b.featureCollection
                }
            }
        }
        for (var d = 0; d < g.layers.length; d++) {
            var h = new esri.layers.FeatureLayer(g.layers[d]);
            var c = (g.layers.length > 1) ? j + " " + (d + 1) : j;
            h.setInfoTemplate(new esri.InfoTemplate(c, ""));
            h.name = c;
            h.renderer.label = c;
            dojo.connect(h, "onError", this, this.errorAddingLayer(h));
            f.push(h)
        }
        this.map.addLayers(f);
        this.layers = f;
        this.success()
    },
    layerAdded: function (b) {
        this.addedServiceCounter--;
        this.map.addLayer(b);
        if (this.layers === null) {
            this.layers = []
        }
        this.layers.push(b);
        if (this.addedServiceCounter === 0) {
            this.success()
        }
    },
    errorAddingLayer: function (b) {
        this.layers = null;
        return function (c) {
            this.addedServiceCounter--;
            this.map.removeLayer(b);
            if (typeof c === "string" && c.indexOf("GetCapabilities request for") !== -1) {
                this.failure(this.generateExtError("Error adding WMS layer", this.errorCodes.ADDWMSLAYERFAILED))
            } else {
                this.failure(this.generateExtError(c.msg, this.errorCodes.ADDLAYERFAILED))
            }
        }
    },
    generateExtError: function (c, b) {
        return new Ext.Error({
            msg: c,
            errorCode: b
        })
    },
    getLayers: function () {
        return this.layers
    }
});
Ext.define("ca.esri.core.tool.addlayer.locale.en", {
    addStrings: function () {
        app.locale.add("AddLayerText", "Add data");
        app.locale.add("AddLayerTooltip", "Add data to map");
        app.locale.add("AddLayerTitle", "Add Data");
        app.locale.add("AddLayerLoadMask", "Adding data to map...");
        app.locale.add("AddLayerSelectAgs", "ArcGIS Server Web Service");
        app.locale.add("AddLayerSelectWms", "OGC Web Map Service (WMS)");
        app.locale.add("AddLayerSelectShp", "Shapefile (Zip file; max 1000 records)");
        app.locale.add("AddLayerUrlLabel", "Service URL");
        app.locale.add("AddLayerUrlEmptyText", "enter URL here");
        app.locale.add("AddLayerFileLabel", "File");
        app.locale.add("AddLayerFileChoose", "Select shapefile...");
        app.locale.add("AddLayerSubmitButton", "Add data to map");
        app.locale.add("AddLayerErrorDialogTitle", "Error");
        app.locale.add("AddLayerErrorUnknownError", "An unknown error occurred");
        app.locale.add("AddLayerErrorMapserviceUnsupported", "Unknown map service type");
        app.locale.add("AddLayerErrorServiceDown", "A required service is down");
        app.locale.add("AddLayerErrorInvalidWms", "The WMS service could not be added to the map");
        app.locale.add("AddLayerErrorParseFilename", "Invalid file name.  The zip file's name must end in .zip");
        app.locale.add("AddLayerErrorSecuredLayer", "This layer is part of a secured service.  Secured services are not currently supported.");
        app.locale.add("AddLayerErrorMaxRecordsReached", "The shapefile had too many records. The maximum is 1000.");
        app.locale.add("AddLayerErrorInvalidZipFile", "The zip file could not be parsed.  Please ensure that the zip file is valid and not password protected.");
        app.locale.add("AddLayerErrorInvalidShapefile", "The shapefile could not be parsed.  Please ensure that the zip file contains a valid shapefile.")
    }
});
Ext.define("ca.esri.core.tool.addlayer.locale.fr", {
    addStrings: function () {
        app.locale.add("AddLayerText", "Ajouter du contenu");
        app.locale.add("AddLayerTooltip", "Ajouter du contenu à la carte");
        app.locale.add("AddLayerTitle", "Ajouter du contenu");
        app.locale.add("AddLayerLoadMask", "Ajoute du contenu à la carte...");
        app.locale.add("AddLayerSelectAgs", "Service Web d'ArcGIS Server");
        app.locale.add("AddLayerSelectWms", "Service de carte de l’OGC (WMS)");
        app.locale.add("AddLayerSelectShp", "Shapefile (fichier Zip; max 1000 enregistrements)");
        app.locale.add("AddLayerUrlLabel", "URL du Service ");
        app.locale.add("AddLayerUrlEmptyText", "Entrer l'URL ici");
        app.locale.add("AddLayerFileLabel", "Fichier");
        app.locale.add("AddLayerFileChoose", "Sélectionner le fichier shapefile...");
        app.locale.add("AddLayerSubmitButton", "Ajouter du contenu à la carte");
        app.locale.add("AddLayerErrorDialogTitle", "Erreur");
        app.locale.add("AddLayerErrorUnknownError", "Une erreur inconnue s'est produite");
        app.locale.add("AddLayerErrorMapserviceUnsupported", "Type de service de carte inconnu");
        app.locale.add("AddLayerErrorServiceDown", "Un service requis est en panne");
        app.locale.add("AddLayerErrorInvalidWms", "Le service WMS n'a pu être ajouté à la carte");
        app.locale.add("AddLayerErrorParseFilename", "Nom de fichier invalide.  Le nom du fichier compressé doit se terminer en .zip");
        app.locale.add("AddLayerErrorSecuredLayer", "Cette couche fait partie d'un service sécurisé.  Actuellement, les services sécurisés ne sont pas supportés.");
        app.locale.add("AddLayerErrorMaxRecordsReached", "Le fichier shapefile a un nombre trop élevé d'enregistrements. Le maximum est de 1000.");
        app.locale.add("AddLayerErrorInvalidZipFile", "Le fichier zip n'a pas pu être traité.  S.V.P. s'assurer que le fichier zip est valide et non protégé par un mot de passe.");
        app.locale.add("AddLayerErrorInvalidShapefile", "Le fichier shapefile n'a pas pu être traité.  S.V.P. s'assurer que le fichier zip contient un fichier shapefile valide.")
    }
});
dojo.require("esri.dijit.Bookmarks");
Ext.define("ca.esri.core.tool.bookmarks.Window", {
    extend: "Ext.window.Window",
    id: "BookmarksWindow",
    constrainHeader: true,
    shadow: false,
    collapsible: true,
    bodyPadding: 7,
    bodyCls: "claro",
    margin: 3,
    defaults: {
        style: {
            margin: "3px"
        }
    },
    // tools: [{
        // type: "help",
        // handler: function (d, e, b, c) {
            // app.openHelp(app.HELP_ROOT + "/Bookmarks.html")
        // }
    // }],
    title: "Bookmarks",
    layout: "fit",
    width: 300,
    minWidth: 300,
    height: 200,
    closeAction: "hide",
    panel: null,
    esriBookmarksCss: ["#BookmarkWindowPanel td {", "    padding: 3px 0px 5px 3px;", "}", ".esriBookmarkTable {", "    border-collapse: collapse;", "    border-spacing: 0;", "    width: 100%;", "}", ".esriBookmarkLabel {", "    color: black;", "    cursor: pointer;", "    float: left;", "    font-family: Verdana,Helvetica,sans-serif;", "    font-size: 12px;", "    height: 20px;", "    line-height: 20px;", "    margin-left: 5px;", "    overflow: hidden;", "    position: relative;", "    text-align: left;", "    vertical-align: middle;", "    white-space: nowrap;", "    width: 70%;", "}", ".esriBookmarks {", "    border: none;", "    width: 100%;", "}", ".esriBookmarkItem {", "    height: 20px;", "    width: 100%;", "}", ".esriAddBookmark {", "}", ".esriBookmarkHighlight {", "    background-color: #D9E6F9;", "}", ".esriBookmarkEditImage {", "    background: url('http://serverapi.arcgisonline.com/jsapi/arcgis/3.1/js/esri/dijit/images/edit.png') no-repeat scroll center center transparent;", "    cursor: pointer;", "    float: right;", "    width: 30px;", "}", ".esriBookmarkRemoveImage {", "    background: url('http://serverapi.arcgisonline.com/jsapi/arcgis/3.1/js/esri/dijit/images/close.gif') no-repeat scroll center center transparent;", "    cursor: pointer;", "    float: right;", "    width: 30px;", "}", ".esriBookmarkEditBox {", "    font-size: 12px;", "    height: 20px;", "    position: relative;", "    width: 180px;", "}"].join(""),
    constructor: function (b) {
        this.initConfig(b);
        this.callParent([b])
    },
    initComponent: function () {
        this.callParent(arguments);
        this.title = app.locale.i18n("BookmarksTitle");
        this.panel = Ext.create("Ext.panel.Panel", {
            id: "BookmarkWindowPanel",
            layout: "fit",
            autoScroll: true
        });
        this.add(this.panel);
        Ext.util.CSS.createStyleSheet(this.esriBookmarksCss, "esriBookmarksCss");
        this.on("afterrender", this.onAfterRender)
    },
    onAfterRender: function (c, b) {
        var d = new esri.dijit.Bookmarks({
            map: app.map,
            bookmarks: [],
            editable: true
        }, dojo.byId(this.panel.getContentTarget().id));
        d._editBookmarkLabel = function (g) {
            d.constructor.prototype._editBookmarkLabel.call(d, g);
            var f = d.bookmarkDomNode.getElementsByTagName("input");
            if (f.length > 0) {
                f[0].style.left = "0px";
                f[0].style.top = "-20px"
            }
        };
        this.un("afterrender", this.onAfterRender)
    },
    destroy: function () {
        Ext.util.CSS.removeStyleSheet("esriBookmarksCss");
        this.callParent(arguments)
    }
});
Ext.define("ca.esri.core.tool.bookmarks.locale.en", {
    addStrings: function () {
        app.locale.add("BookmarksText", "Bookmarks");
        app.locale.add("BookmarksTooltip", "Bookmarks");
        app.locale.add("BookmarksTitle", "Bookmarks")
    }
});
Ext.define("ca.esri.core.tool.bookmarks.locale.fr", {
    addStrings: function () {
        app.locale.add("BookmarksText", "Signets");
        app.locale.add("BookmarksTooltip", "Signets");
        app.locale.add("BookmarksTitle", "Signets")
    }
});
dojo.require("esri.dijit.BasemapGallery");
Ext.define("ca.esri.core.tool.changebasemap.Window", {
    extend: "Ext.window.Window",
    id: "ChangeBasemapWindow",
    constrainHeader: true,
    shadow: false,
    collapsible: true,
    bodyPadding: 7,
    bodyCls: "claro",
    margin: 3,
    defaults: {
        style: {
            margin: "3px"
        }
    },
    // tools: [{
        // type: "help",
        // handler: function (d, e, b, c) {
            // app.openHelp(app.HELP_ROOT + "#base")
        // }
    // }],
    layout: "fit",
    width: 410,
    height: 410,
    panel: null,
    basemapGallery: null,
    onLayerAddHandler: null,
    initComponent: function () {
        this.callParent(arguments);
        this.title = app.locale.i18n("ChangeBasemapWindowTitle");
        this.panel = Ext.create("Ext.panel.Panel", {
            id: "ChangeBasemapWindowPanel",
            xtype: "panel",
            autoScroll: true,
            layout: {
                type: "fit",
                manageOverflow: 2
            }
        });
        this.add(this.panel);
        this.on("afterrender", this.onAfterRender)
    },
    onAfterRender: function (c, b) {
        this.dijitPane = new dijit.layout.ContentPane({}, dojo.byId(this.panel.getContentTarget().id));
        this.dijitPane.set("content", '<div id="emafBasemapGalleryChildDiv"></div>');
        this.basemapGallery = new esri.dijit.BasemapGallery({
            showArcGISBasemaps: true,
            map: app.map
        }, "emafBasemapGalleryChildDiv");
        this.basemapGallery.startup();
        this.onLayerAddHandler = dojo.connect(app.map, "onLayerAdd", function (d) {
            if (d.hasOwnProperty("_basemapGalleryLayerType")) {
                d.includeInLegend = false
            }
        });
        this.un("afterrender", this.onAfterRender)
    },
    destroy: function () {
        if (this.basemapGallery !== null) {
            this.basemapGallery.destroy();
            this.basemapGallery = null
        }
        if (this.dijitPane !== null) {
            this.dijitPane.destroy();
            this.dijitPane = null
        }
        if (this.panel != null) {
            this.panel.destroy();
            this.panel = null
        }
        dojo.disconnect(this.onLayerAddHandler);
        this.onLayerAddHandler.remove();
        this.onLayerAddHandler = null;
        this.callParent(arguments)
    },
    errorHandler: function (b) {
        alert(app.locale.i18n("ErrorMsg") + this.$className + " - " + b.message)
    }
});
Ext.define("ca.esri.core.tool.changebasemap.locale.en", {
    addStrings: function () {
        app.locale.add("ChangeBasemapWindowTitle", "Change Basemap");
        app.locale.add("ChangeBasemapText", "Basemap");
        app.locale.add("ChangeBasemapTooltip", "Basemap gallery")
    }
});
Ext.define("ca.esri.core.tool.changebasemap.locale.fr", {
    addStrings: function () {
        app.locale.add("ChangeBasemapWindowTitle", "Changer de fond de carte");
        app.locale.add("ChangeBasemapText", "Fond de carte");
        app.locale.add("ChangeBasemapTooltip", "Bibliothèque de fonds de carte")
    }
});
Ext.define("ca.esri.core.tool.dynamicrenderer.ClassificationMethodModel", {
    extend: "Ext.data.Model",
    fields: [{
        name: "type",
        type: "string"
    }, {
        name: "name",
        type: "string"
    }]
});
Ext.define("ca.esri.core.tool.dynamicrenderer.locale.en", {
    addStrings: function () {
        app.locale.add("DRText", "Dynamic renderer");
        app.locale.add("DRTooltip", "Display dynamic renderer");
        app.locale.add("DRTitle", "Dynamic Renderer");
        app.locale.add("DRSelectLayer", "Select the layer to use...");
        app.locale.add("DRSelectField", "Select the field to use...");
        app.locale.add("DRSelectClassMethod", "Select the classification method to use...");
        app.locale.add("DRClassMethodEqInt", "Equal interval");
        app.locale.add("DRClassMethodNatBrks", "Natural breaks");
        app.locale.add("DRClassMethodQuantile", "Quantile");
        app.locale.add("DRClassMethodStdDev", "Standard deviation");
        app.locale.add("DRClassMethodGeoInt", "Geometrical interval");
        app.locale.add("DRSelectClassBreaks", "Select the number of classification breaks...");
        app.locale.add("DRColourRamp", "Colour ramp");
        app.locale.add("DRFrom", "From");
        app.locale.add("DRTo", "To");
        app.locale.add("DRRenderMap", "Render map");
        app.locale.add("DRCannotConnect", "Cannot connect to mapping service. Please try again later.")
    }
});
Ext.define("ca.esri.core.tool.dynamicrenderer.locale.fr", {
    addStrings: function () {
        app.locale.add("DRText", "{fr}Dynamic renderer");
        app.locale.add("DRTooltip", "{fr}Display dynamic renderer");
        app.locale.add("DRTitle", "{fr}Dynamic Renderer");
        app.locale.add("DRSelectLayer", "{fr}Select the layer to use...");
        app.locale.add("DRSelectField", "{fr}Select the field to use...");
        app.locale.add("DRSelectClassMethod", "{fr}Select the classification method to use...");
        app.locale.add("DRClassMethodEqInt", "{fr}Equal interval");
        app.locale.add("DRClassMethodNatBrks", "{fr}Natural breaks");
        app.locale.add("DRClassMethodQuantile", "{fr}Quantile");
        app.locale.add("DRClassMethodStdDev", "{fr}Standard deviation");
        app.locale.add("DRClassMethodGeoInt", "{fr}Geometrical interval");
        app.locale.add("DRSelectClassBreaks", "{fr}Select the number of classification breaks...");
        app.locale.add("DRColourRamp", "{fr}Colour ramp");
        app.locale.add("DRFrom", "{fr}From");
        app.locale.add("DRTo", "{fr}To");
        app.locale.add("DRRenderMap", "{fr}Render map");
        app.locale.add("DRCannotConnect", "{fr}Cannot connect to mapping service. Please try again later.")
    }
});
Ext.define("ca.esri.core.tool.help.locale.en", {
    addStrings: function () {
        app.locale.add("HelpText", "Help");
        app.locale.add("HelpTooltip", "Help");
        app.locale.add("HelpTitle", "Help")
    }
});
Ext.define("ca.esri.core.tool.help.locale.fr", {
    addStrings: function () {
        app.locale.add("HelpText", "Aide");
        app.locale.add("HelpTooltip", "Aide");
        app.locale.add("HelpTitle", "Aide")
    }
});
Ext.define("ca.esri.core.tool.identify.Window", {
    extend: "Ext.window.Window",
    border: 1,
    maxWidth: 800,
    resizable: false,
    bodyBorder: true,
    collapsible: true,
    closeAction: "hide",
    layout: "anchor",
    constrain: true,
    constrainHeader: true,
    bodyPadding: 3,
    // tools: [{
        // type: "help",
        // handler: function (d, e, b, c) {
            // app.openHelp(app.HELP_ROOT + "/IdentifyHelp.html")
        // }
    // }],
    theGrid: null,
    theSelect: null,
    clickPoint: null,
    mapPoint: null,
    clickGraphic: null,
    highlightGraphic: null,
    geometries: null,
    constructor: function (b) {
        this.initConfig(b);
        Ext.create("ca.esri.core.tool.identify.locale." + dojo.locale).addStrings();
        this.callParent([b])
    },
    initComponent: function () {
        var c = this;
        var b = Ext.create("Ext.data.Store", {
            fields: ["id", "name"],
            data: []
        });
        this.theSelect = Ext.create("Ext.form.ComboBox", {
            fieldLabel: app.locale.i18n("Layers"),
            store: b,
            queryMode: "local",
            displayField: "name",
            valueField: "id",
            flex: 0,
            listeners: {
                change: dojo.hitch(c, c.onLayerChange)
            }
        });
        Ext.applyIf(c, {
            defaults: {
                style: {
                    margin: 3
                }
            },
            title: app.locale.i18n("Identify"),
            items: [c.theSelect],
            listeners: {
                show: function () {
                    Ext.EventManager.on(document, "click", c.checkClick, c);
                    c.mapUpdateHandler = dojo.connect(app.map, "onUpdateEnd", function () {
                        c.theSelect.getStore().removeAll();
                        c.theSelect.getStore().loadRawData(c.getCurrentLayers())
                    })
                },
                hide: function () {
                    c.unsetMap();
                    Ext.EventManager.un(document, "click", this.checkClick, this);
                    app.map.graphics.remove(c.highlightGraphic);
                    app.map.graphics.remove(c.clickGraphic);
                    dojo.disconnect(c.mapUpdateHandler)
                }
            }
        });
        c.callParent(arguments)
    },
    getCurrentLayers: function () {
        var c = app.map.getLayersVisibleAtScale().reverse();
        var b = [];
        for (i in c) {
            if (c[i].visible == false) {
                continue
            }
            if (c[i].declaredClass === "esri.layers.ArcGISTiledMapServiceLayer") {
                continue
            } else {
                if (c[i].declaredClass === "esri.layers.ArcGISImageServiceLayer") {
                    continue
                } else {
                    if (c[i].declaredClass === "esri.layers.WMSLayer") {
                        continue
                    }
                }
            }
            if (c[i].declaredClass === "esri.layers.FeatureLayer") {
                continue
            } else {
                if (c[i].declaredClass === "esri.layers.ArcGISDynamicMapServiceLayer") {
                    if (c[i].visibleLayers[0] == -1) {
                        continue
                    }
                    for (l in c[i].visibleLayers) {
                        if ((c[i].layerInfos[c[i].visibleLayers[l]].maxScale <= app.map.getScale() && c[i].layerInfos[c[i].visibleLayers[l]].minScale >= app.map.getScale()) || (c[i].layerInfos[c[i].visibleLayers[l]].maxScale == c[i].layerInfos[c[i].visibleLayers[l]].minScale)) {
                            b.push({
                                id: c[i].id + "|" + c[i].visibleLayers[l],
                                name: c[i].layerInfos[c[i].visibleLayers[l]].name
                            })
                        }
                    }
                } else {}
            }
        }
        return b
    },
    onLayerChange: function (b) {
        this.execute()
    },
    checkClick: function (b) {
        if (!b.within(this.getEl())) {}
    },
    execute: function (h, j, d) {
        var f = this;
        if (f.theGrid !== null) {
            f.remove(f.theGrid)
        }
        var m = this.theSelect.getValue().split("|")[0];
        if (m === "") {
            return
        }
        var g = this.theSelect.getValue().split("|")[1];
        if (g === "") {
            return
        }
        var e = app.map.getLayer(m);
        if (!e) {
            f.setLoading(false);
            return false
        }
        if (e.declaredClass === "esri.layers.FeatureLayer") {
            this.handleFeatureLayer(e, this.mapPoint)
        } else {}
        var c = new esri.tasks.IdentifyTask(e.url);
        var b = new esri.tasks.IdentifyParameters();
        b.layerOption = esri.tasks.IdentifyParameters.LAYER_OPTION_VISIBLE;
        b.tolerance = 3;
        b.returnGeometry = true;
        b.width = app.map.width;
        b.height = app.map.height;
        b.mapExtent = app.map.extent;
        b.geometry = this.mapPoint;
        f.setLoading();
        var k = c.execute(b);
        if (d !== null) {
            k.addErrback(d)
        }
        if (j !== null) {
            k.addCallback(j)
        }
        k.then(function (q) {
            f.features = q;
            var o = [];
            var r = [];
            var p = null;
            if (q.length > 0) {
                r.push({
                    xtype: "actioncolumn",
                    width: 25,
                    items: [{
                        align: "center",
                        icon: this.CLIENT_ROOT + "images/tools/zoom.png",
                        tooltip: app.locale.i18n("Zoom to"),
                        altText: app.locale.i18n("Zoom to"),
                        handler: f.zoomTo
                    }]
                });
                var n = q[0].feature.attributes;
                for (a in n) {
                    o.push(a);
                    r.push({
                        text: a,
                        dataIndex: a
                    })
                }
                var s = dojo.map(q, function (t) {
                    var u = t.feature;
                    u.attributes.geometry = u.geometry;
                    return u.attributes
                });
                p = Ext.create("Ext.data.Store", {
                    fields: o,
                    data: s
                });
                f.theGrid = Ext.create("Ext.grid.Panel", {
                    store: p,
                    columns: r,
                    emptyText: app.locale.i18n("No data"),
                    stripeRows: true,
                    anchor: "-0",
                    title: q[0].layerName,
                    listeners: {
                        selectionChange: dojo.hitch(f, f.hightlightResponse),
                        viewready: function () {
                            this.getSelectionModel().select(0)
                        }
                    }
                })
            } else {
                f.theGrid = Ext.create("Ext.Panel", {
                    html: app.locale.i18n("No data"),
                    header: false,
                    anchor: "-0"
                })
            }
            f.add(f.theGrid);
            f.doLayout();
            f.setLoading(false)
        }, function (o) {
            var n = Ext.create("Ext.data.Store", {
                fields: [app.locale.i18n("Error")],
                data: [o.message]
            });
            f.theGrid = Ext.create("Ext.grid.Panel", {
                store: n,
                columns: [app.locale.i18n("Error")],
                stripeRows: true,
                anchor: "-0",
                title: response[0].layerName,
                listeners: {
                    selectionChange: dojo.hitch(f, f.hightlightResponse),
                    viewready: function () {
                        this.getSelectionModel().select(0)
                    }
                }
            });
            f.add(f.theGrid);
            f.doLayout();
            f.setLoading(false)
        })
    },
    show: function (e, c) {
        this.clickPoint = e;
        this.mapPoint = app.map.toMap(e);
        if (this.theGrid !== null) {
            this.remove(this.theGrid)
        }
        this.theSelect.getStore().removeAll();
        this.theSelect.getStore().loadRawData(this.getCurrentLayers());
        if (this.theSelect.getValue() === null) {
            if (this.theSelect.getStore().totalCount == 0) {
                alert(app.locale.i18n("No layers are available to identify"));
                return false
            }
            this.theSelect.setValue(this.theSelect.getStore().getAt("0").get("id"))
        } else {
            this.execute()
        }
        var b = new esri.geometry.Point(this.mapPoint.x, this.mapPoint.y, new esri.SpatialReference({
            wkid: 102100
        }));
        var d = new esri.symbol.SimpleMarkerSymbol(esri.symbol.SimpleMarkerSymbol.STYLE_X, 10, new esri.symbol.SimpleLineSymbol(esri.symbol.SimpleLineSymbol.STYLE_SOLID, new dojo.Color([255, 0, 0]), 1), new dojo.Color([0, 255, 0, 0.25]));
        if (this.clickGraphic) {
            app.map.graphics.remove(this.clickGraphic)
        }
        this.clickGraphic = new esri.Graphic(b, d);
        app.map.graphics.add(this.clickGraphic);
        this.superclass.show.call(this)
    },
    handleFeatureLayer: function (b, c) {},
    hightlightResponse: function (e, c, b) {
        var d = null;
        switch (c[0].raw.Shape) {
        case "Point":
            d = new esri.symbol.SimpleMarkerSymbol(esri.symbol.SimpleMarkerSymbol.STYLE_SQUARE, 15, new esri.symbol.SimpleLineSymbol(esri.symbol.SimpleLineSymbol.STYLE_SOLID, new dojo.Color([255, 0, 0]), 1), new dojo.Color([98, 194, 204, 0.5]));
            break;
        case "Polygon":
            d = new esri.symbol.SimpleFillSymbol(esri.symbol.SimpleFillSymbol.STYLE_NULL, new esri.symbol.SimpleLineSymbol(esri.symbol.SimpleLineSymbol.STYLE_SOLID, new dojo.Color([98, 194, 204]), 2), new dojo.Color([98, 194, 204, 4]));
            break;
        case "Polyline":
            d = new esri.symbol.SimpleLineSymbol(esri.symbol.SimpleLineSymbol.STYLE_SOLID, new dojo.Color([98, 194, 204]), 4)
        }
        app.map.graphics.remove(this.highlightGraphic);
        this.highlightGraphic = new esri.Graphic(c[0].raw.geometry, d);
        app.map.graphics.add(this.highlightGraphic)
    },
    zoomTo: function (c, e, b) {
        var d = c.getStore().getAt(e);
        c.select(e);
        if (d.raw.Shape === "Point") {
            app.map.centerAndZoom(d.raw.geometry, app.map.getMaxZoom())
        } else {
            app.map.setExtent(d.raw.geometry.getExtent(), true)
        }
    },
    unsetMap: function () {
        if (this.theGrid !== null) {
            this.remove(this.theGrid)
        }
    }
});
Ext.define("ca.esri.core.tool.identify.locale.en", {
    addStrings: function () {
        app.locale.add("Zoom to", "Zoom to");
        app.locale.add("Previous", "Previous");
        app.locale.add("Next", "Next");
        app.locale.add("No data", "{fr}No data");
        app.locale.add("Layers", "Layers");
        app.locale.add("Identify", "Identify")
    }
});
Ext.define("ca.esri.core.tool.identify.locale.fr", {
    addStrings: function () {
        app.locale.add("Zoom to", "{fr}Zoom to");
        app.locale.add("Previous", "{fr}Previous");
        app.locale.add("Next", "{fr}Next");
        app.locale.add("No data", "{fr}No data");
        app.locale.add("Layers", "{fr}Layers");
        app.locale.add("Identify", "{fr}Identify")
    }
});
Ext.define("ca.esri.core.tool.layerlist.WindowOpacity", {
    extend: "Ext.window.Window",
    id: "OpacityWindow",
    width: 135,
    height: 75,
    layouts: "auto",
    constrain: true,
    shadow: false,
    bodyPadding: 7,
    margin: 3,
    defaults: {
        style: {
            margin: "3px"
        }
    },
    // tools: [{
        // type: "help",
        // handler: function (d, e, b, c) {
            // app.openHelp(app.HELP_ROOT + "/help/Opacity.html")
        // }
    // }],
    service: null,
    slider: null,
    initComponent: function () {
        this.callParent(arguments);
        this.title = app.locale.i18n("LayerListOpacityTitle");
        this.slider = Ext.create("Ext.slider.Single", {
            id: "OpacityWindowSlider",
            width: 100,
            hideLabel: true,
            value: parseInt(this.service.opacity * 100),
            increment: 5,
            minValue: 0,
            maxValue: 100,
            listeners: {
                changecomplete: function (d, e, b, c) {
                    this.service.setOpacity(e / 100)
                },
                scope: this
            },
            onKeyDown: function (d) {
                var c = this,
                    b, f;
                if (c.disabled || c.thumbs.length !== 1) {
                    d.preventDefault();
                    return
                }
                b = d.getKey();
                switch (b) {
                case d.UP:
                case d.RIGHT:
                    d.stopEvent();
                    f = d.ctrlKey ? c.maxValue : c.getValue(0) + c.keyIncrement;
                    c.setValue(0, f, undefined, true);
                    break;
                case d.DOWN:
                case d.LEFT:
                    d.stopEvent();
                    f = d.ctrlKey ? c.minValue : c.getValue(0) - c.keyIncrement;
                    c.setValue(0, f, undefined, true);
                    break;
                default:
                }
            }
        });
        this.add(this.slider);
        this.on("afterrender", this.onAfterRender)
    },
    onAfterRender: function (c, b) {
        var d = Ext.getDom("OpacityWindowSlider");
        d.setAttribute("tabindex", "0");
        this.un("afterrender", this.onAfterRender)
    }
});
Ext.define("ca.esri.core.tool.layerlist.locale.en", {
    addStrings: function () {
        app.locale.add("LayerListText", "Contents");
        app.locale.add("LayerListTooltip", "Manage contents of map and view metadata");
        app.locale.add("LayerListTitle", "Contents");
        app.locale.add("LayerListMapLayers", "Map Layers");
        app.locale.add("LayerListFeatureLayers", "Feature Layers");
        app.locale.add("LayerListLayerOutofScale", "This layer is not visible at the map's scale.");
        app.locale.add("LayerListNoLayers", "No layers to choose from.");
        app.locale.add("LayerListRemove", "Remove");
        app.locale.add("LayerListRemoveService", "Remove Service...");
        app.locale.add("LayerListRemoveConfirm", "Are you sure you wish to remove this service from the map?");
        app.locale.add("LayerListMoveUp", "Move up");
        app.locale.add("LayerListMoveDown", "Move down");
        app.locale.add("LayerListOpacity", "Set opacity...");
        app.locale.add("LayerListOpacityTitle", "Adjust Opacity");
        app.locale.add("LayerListViewMetadata", "View metadata...")
    }
});
Ext.define("ca.esri.core.tool.layerlist.locale.fr", {
    addStrings: function () {
        app.locale.add("LayerListText", "Contenu");
        app.locale.add("LayerListTooltip", "Gérer le contenu de la carte et accéder aux métadonnées");
        app.locale.add("LayerListTitle", "Contenu");
        app.locale.add("LayerListMapLayers", "Couches de cartes");
        app.locale.add("LayerListFeatureLayers", "Couches d'entités");
        app.locale.add("LayerListLayerOutofScale", "Cette couche n'est pas visible à l'échelle de la carte");
        app.locale.add("LayerListNoLayers", "Aucune couche ne peut être choisie");
        app.locale.add("LayerListRemove", "Retirer");
        app.locale.add("LayerListRemoveService", "Retirer ce service...");
        app.locale.add("LayerListRemoveConfirm", "Êtes-vous sûr de vouloir retirer ce service de la carte?");
        app.locale.add("LayerListMoveUp", "Monter");
        app.locale.add("LayerListMoveDown", "Descendre");
        app.locale.add("LayerListOpacity", "Régler l'opacité...");
        app.locale.add("LayerListOpacityTitle", "Ajuster l'opacité");
        app.locale.add("LayerListViewMetadata", "Métadonnées...")
    }
});
dojo.require("esri.dijit.Legend");
Ext.define("ca.esri.core.tool.legend.Window", {
    extend: "Ext.window.Window",
    id: "LegendWindow",
    constrainHeader: true,
    shadow: false,
    collapsible: true,
    bodyPadding: 7,
    bodyCls: "claro",
    margin: 3,
    defaults: {
        style: {
            margin: "3px"
        }
    },
    // tools: [{
        // type: "help",
        // handler: function (d, e, b, c) {
            // app.openHelp(app.HELP_ROOT + "#leg")
        // }
    // }],
    layout: "fit",
    width: 300,
    height: 500,
    panel: null,
    layerInfos: null,
    dijitLegend: null,
    mapOnUpdateEndHandler: null,
    mapOnLayerRemoveHandler: null,
    closeAction: "hide",
    initComponent: function () {
        this.callParent(arguments);
        this.title = app.locale.i18n("LegendTitle");
        this.panel = Ext.create("Ext.panel.Panel", {
            id: "LegendWindowPanel",
            layout: "fit",
            autoScroll: true
        });
        this.add(this.panel);
        this.on("afterrender", this.onAfterRender)
    },
    onAfterRender: function (c, b) {
        this.setPosition(0, app.toolbar.getEl().getBox().bottom);
        this.dijitLegend = new esri.dijit.Legend({
            map: app.map,
            style: {
                padding: "5px"
            },
            layerInfos: this.layerInfos
        }, dojo.byId(this.panel.getContentTarget().id));
        this.dijitLegend.startup();
        this.mapOnUpdateEndHandler = dojo.connect(app.map, "onUpdateEnd", this, function () {
            this.dijitLegend.refresh()
        });
        this.mapOnLayerRemoveHandler = dojo.connect(app.map, "onLayerRemove", this, function () {
            this.dijitLegend.refresh()
        });
        this.un("afterrender", this.onAfterRender)
    },
    destroy: function () {
        dojo.disconnect(this.mapOnUpdateEndHandler);
        this.mapOnUpdateEndHandler.remove();
        this.mapOnUpdateEndHandler = null;
        dojo.disconnect(this.mapOnLayerRemoveHandler);
        this.mapOnLayerRemoveHandler.remove();
        this.mapOnLayerRemoveHandler = null;
        if (this.dijitLegend != null) {
            this.dijitLegend.destroy();
            this.dijitLegend = null
        }
        if (this.panel != null) {
            this.panel.destroy();
            this.panel = null
        }
        this.callParent(arguments)
    },
    errorHandler: function (b) {
        alert(app.locale.i18n("ErrorMsg") + this.$className + " - " + b.message)
    }
});
Ext.define("ca.esri.core.tool.legend.locale.en", {
    addStrings: function () {
        app.locale.add("LegendText", "Legend");
        app.locale.add("LegendTooltip", "Show map legend");
        app.locale.add("LegendTitle", "Legend")
    }
});
Ext.define("ca.esri.core.tool.legend.locale.fr", {
    addStrings: function () {
        app.locale.add("LegendText", "Légende");
        app.locale.add("LegendTooltip", "Afficher la légende de la  carte");
        app.locale.add("LegendTitle", "Légende")
    }
});
Ext.define("ca.esri.core.tool.link.Window", {
    extend: "Ext.window.Window",
    id: "LinkWindow",
    shadow: false,
    width: 500,
    border: false,
    layout: "auto",
    modal: true,
    closable: true,
    defaults: {
        style: {
            margin: "5px"
        }
    },
    // tools: [{
        // type: "help",
        // handler: function (d, e, b, c) {
            // app.openHelp(app.HELP_ROOT + "#link")
        // }
    // }],
    bodyStyle: {
        background: "transparent"
    },
    initComponent: function () {
        this.callParent(arguments);
        var b = (app.map.extent.xmin - app.map.extent.xmax) / 2;
        b = app.map.extent.xmin - b;
        var f = (app.map.extent.ymax - app.map.extent.ymin) / 2;
        f = app.map.extent.ymin + f;
        var c = window.location.href;
        if (c.indexOf("?") === -1) {
            c = c + "?"
        } else {
            c = c + "&"
        }
        var d = [c, "x=", b, "&y=", f, "&level=", app.map.getLevel()].join("");
        this.title = app.locale.i18n("LinkTitle");
        var e = Ext.create("Ext.form.field.Text", {
            selectOnFocus: true,
            value: d,
            width: 470,
            fieldLabel: app.locale.i18n("LinkLabel"),
            labelWidth: (dojo.locale === "en") ? 101 : 156,
            wcagTitle: app.locale.i18n("LinkTitle")
        });
        this.add([e])
    }
});
Ext.define("ca.esri.core.tool.link.locale.en", {
    addStrings: function () {
        app.locale.add("LinkText", "Link");
        app.locale.add("LinkTooltip", "Show link to map");
        app.locale.add("LinkTitle", "Link");
        app.locale.add("LinkLabel", "Copy for later use")
    }
});
Ext.define("ca.esri.core.tool.link.locale.fr", {
    addStrings: function () {
        app.locale.add("LinkText", "Lien");
        app.locale.add("LinkTooltip", "Indiquer le lien vers la carte");
        app.locale.add("LinkTitle", "Lien");
        app.locale.add("LinkLabel", "Copier pour usage ultérieur")
    }
});
Ext.define("ca.esri.core.tool.locator.Model", {
    extend: "Ext.data.Model",
    fields: [{
        name: "address",
        type: "string"
    }, {
        name: "x",
        type: "float"
    }, {
        name: "y",
        type: "float"
    }]
});
Ext.define("ca.esri.core.tool.locator.locale.en", {
    addStrings: function () {
        app.locale.add("LocatorTooltip", "Search in map");
        app.locale.add("LocatorTitle", "Search in map");
        app.locale.add("LocatorEmptyText", "Place name or postal code to search for...");
        app.locale.add("LocatorDisplayOnMap", "Display on map")
    }
});
Ext.define("ca.esri.core.tool.locator.locale.fr", {
    addStrings: function () {
        app.locale.add("LocatorTooltip", "{fr}Search in map");
        app.locale.add("LocatorTitle", "{fr}Search in map");
        app.locale.add("LocatorEmptyText", "{fr}Place name or postal code to search for...");
        app.locale.add("LocatorDisplayOnMap", "Afficher sur la carte")
    }
});
dojo.require("esri.dijit.Measurement");
Ext.define("ca.esri.core.tool.measure.Window", {
    extend: "Ext.window.Window",
    id: "MeasureWindow",
    constrainHeader: true,
    shadow: false,
    collapsible: true,
    bodyPadding: 7,
    bodyCls: "claro",
    margin: 3,
    defaults: {
        style: {
            margin: "3px"
        }
    },
    // tools: [{
        // type: "help",
        // handler: function (d, e, b, c) {
            // app.openHelp(app.HELP_ROOT + "#meas")
        // }
    // }],
    layout: "fit",
    width: 305,
    height: 200,
    panel: null,
    dijitMeasurement: null,
    popupZIndexHandler: null,
    onMapClick: function (b) {},
    initComponent: function () {
        this.callParent(arguments);
        this.title = app.locale.i18n("MeasureTitle");
        this.panel = Ext.create("Ext.panel.Panel", {
            id: "MeasureWindowPanel",
            layout: "fit",
            autoScroll: true,
            listeners: {
                click: {
                    fn: this.onPanelBodyClick,
                    element: "body",
                    delay: 100,
                    scope: this
                }
            }
        });
        this.add(this.panel);
        this.on("afterrender", this.onAfterRender);
        esri.bundle.widgets.measurement.NLS_length_kilometers = app.locale.i18n("MeasureKilometre");
        esri.bundle.widgets.measurement.NLS_length_meters = app.locale.i18n("MeasureMetre");
        esri.bundle.widgets.measurement.NLS_area_sq_kilometers = app.locale.i18n("MeasureSqKilometre");
        esri.bundle.widgets.measurement.NLS_area_sq_meters = app.locale.i18n("MeasureSqMetre")
    },
    onAfterRender: function (c, b) {
        this.dijitPane = new dijit.layout.ContentPane({}, dojo.byId(this.panel.getContentTarget().id));
        this.dijitMeasurement = new esri.dijit.Measurement({
            map: app.map,
            defaultAreaUnit: esri.Units.SQUARE_KILOMETERS,
            defaultLengthUnit: esri.Units.KILOMETERS
        });
        this.dijitPane.set("content", this.dijitMeasurement);
        app.mapClickManager.on("mapClickRegistered", this.onMapClickRegister, this);
        dojo.connect(this.dijitMeasurement, "onMeasureEnd", dojo.hitch(this, function (d, e) {
            if (d === "location") {
                this.dijitMeasurement.setTool(d, false);
                app.mapClickManager.unsetHandler(this.$className)
            }
        }));
        this.popupZIndexHandler = dojo.connect(this.dijitPane, "onClick", this, function () {
            var d = dojo.query(".dijitPopup");
            for (var e = 0; e < d.length; e++) {
                d[e].style.zIndex = 1000000
            }
        });
        this.dijitMeasurement.startup();
        this.dijitMeasurement.setTool("area", true);
        app.mapClickManager.setHandler(this.$className, this.onMapClick);
        this.un("afterrender", this.onAfterRender)
    },
    destroy: function () {
        if (this.dijitMeasurement !== null) {
            this.dijitMeasurement.destroy();
            this.dijitMeasurement = null
        }
        if (this.dijitPane !== null) {
            this.dijitPane.destroy();
            this.dijitPane = null
        }
        if (this.popupZIndexHandler !== null) {
            dojo.disconnect(this.popupZIndexHandler)
        }
        app.mapClickManager.unsetHandler(this.$className);
        app.mapClickManager.un("mapClickRegistered", this.onMapClickRegister, this);
        if (this.panel !== null) {
            this.panel.destroy();
            this.panel = null
        }
        this.callParent(arguments)
    },
    errorHandler: function (b) {
        alert(app.locale.i18n("ErrorMsg") + this.$className + " - " + b.message)
    },
    onPanelBodyClick: function () {
        if (this.dijitMeasurement.area.checked || this.dijitMeasurement.distance.checked || this.dijitMeasurement.location.checked) {
            app.mapClickManager.setHandler(this.$className, this.onMapClick)
        } else {
            app.mapClickManager.unsetHandler(this.$className)
        }
    },
    onMapClickRegister: function (b) {
        if (b.key === this.$className) {
            if (this.dijitMeasurement[this.dijitMeasurement.activeTool].checked === false) {
                this.dijitMeasurement.setTool(this.dijitMeasurement.activeTool, true)
            }
        } else {
            if (this.dijitMeasurement) {
                this.dijitMeasurement.setTool(this.dijitMeasurement.activeTool, false)
            }
        }
    }
});
Ext.define("ca.esri.core.tool.measure.locale.en", {
    addStrings: function () {
        app.locale.add("MeasureText", "Measure");
        app.locale.add("MeasureTooltip", "Measure area and distance");
        app.locale.add("MeasureTitle", "Measurement Tools");
        app.locale.add("MeasureMetre", "Metres");
        app.locale.add("MeasureSqMetre", "Sq Metres");
        app.locale.add("MeasureKilometre", "Kilometres");
        app.locale.add("MeasureSqKilometre", "Sq Kilometres")
    }
});
Ext.define("ca.esri.core.tool.measure.locale.fr", {
    addStrings: function () {
        app.locale.add("MeasureText", "Mesurer");
        app.locale.add("MeasureTooltip", "Mesurer une superficie ou une distance");
        app.locale.add("MeasureTitle", "Outils de mesure");
        app.locale.add("MeasureMetre", "Mètres");
        app.locale.add("MeasureSqMetre", "Mètres carrés");
        app.locale.add("MeasureKilometre", "Kilomètres");
        app.locale.add("MeasureSqKilometre", "Kilomètres carrés")
    }
});
dojo.require("esri.tasks.PrintTask");
Ext.define("ca.esri.core.tool.printmap.PrintMapUtility", {
    id: "PrintMapUtility",
    config: {
        map: null,
        titleText: null,
        layoutTemplate: null,
        printTaskUrl: null,
        pdfResizeUrl: null,
        success: function () {},
        failure: function () {}
    },
    statics: {
        errorCodes: {
            ESRIREQUESTFAILED: 0,
            PRINTTASKFAILED: 1,
            INVALIDLAYOUTTEMPLATE: 2,
            PDFRESIZEFAILED: 3,
            PDFRESIZERESPONSEJSONERROR: 4,
            PDFRESIZEFALSEPOSITIVE: 5,
            CONFIGERROR: 6
        }
    },
    templateNames: null,
    printTaskOnCompleteHandle: null,
    printTaskOnErrorHandle: null,
    constructor: function (b) {
        this.initConfig(b);
        if (typeof b === "undefined" || typeof b.map === "undefined") {
            Ext.Msg.alert(app.locale.i18n("ErrorMsg") + ca.esri.core.tool.printmap.PrintMapUtility.errorCodes.CONFIGERROR, app.locale.i18n("PrintMapUtilityConfigMapError"));
            Ext.Error.raise({
                msg: app.locale.i18n("PrintMapUtilityConfigMapError"),
                option: b
            })
        }
        if (typeof b === "undefined" || typeof b.titleText === "undefined") {
            Ext.Msg.alert(app.locale.i18n("ErrorMsg") + ca.esri.core.tool.printmap.PrintMapUtility.errorCodes.CONFIGERROR, app.locale.i18n("PrintMapUtilityConfigTitleTextError"));
            Ext.Error.raise({
                msg: app.locale.i18n("PrintMapUtilityConfigTitleTextError")
            })
        }
        if (typeof b === "undefined" || typeof b.layoutTemplate === "undefined") {
            this.layoutTemplate = null;
            console.log("PrintMapUtility: ", app.locale.i18n("PrintMapUtilityConfigLayoutTemplateMessage"))
        }
        if (typeof b === "undefined" || typeof b.printTaskUrl === "undefined") {
            this.printTaskUrl = app.locale.i18n("PrintMapPrintUrl");
            console.log("PrintMapUtility: ", app.locale.i18n("PrintMapUtilityConfigPrintTaskUrlMessage") + ": " + this.printTaskUrl)
        }
        if (typeof b === "undefined" || typeof b.pdfResizeUrl === "undefined") {
            this.pdfResizeUrl = app.locale.i18n("PrintMapPdfResizeUrl");
            console.log("PrintMapUtility: ", app.locale.i18n("PrintMapUtilityConfigPdfResizeUrlMessage") + ": " + this.pdfResizeUrl)
        }
        if (typeof b === "undefined" || typeof b.success === "undefined") {
            Ext.Msg.alert(app.locale.i18n("ErrorMsg") + ca.esri.core.tool.printmap.PrintMapUtility.errorCodes.CONFIGERROR, app.locale.i18n("PrintMapUtilityConfigSuccessCallbackError"));
            Ext.Error.raise({
                msg: app.locale.i18n("PrintMapUtilityConfigSuccessCallbackError"),
                option: b
            })
        }
        if (typeof b === "undefined" || typeof b.failure === "undefined") {
            Ext.Msg.alert(app.locale.i18n("ErrorMsg") + ca.esri.core.tool.printmap.PrintMapUtility.errorCodes.CONFIGERROR, app.locale.i18n("PrintMapUtilityConfigFailureCallbackError"));
            Ext.Error.raise({
                msg: app.locale.i18n("PrintMapUtilityConfigFailureCallbackError"),
                option: b
            })
        }
    },
    execute: function () {
        var b = esri.request({
            url: this.printTaskUrl,
            content: {
                f: "json"
            }
        });
        b.then(dojo.hitch(this, function (c) {
            this.validateLayoutTemplate(c);
            this.resetVisibleLayers();
            this.runESRIPrintTask()
        }), dojo.hitch(this, function (c) {
            this.failure(this.generateExtError(c.message, ca.esri.core.tool.printmap.PrintMapUtility.errorCodes.ESRIREQUESTFAILED))
        }))
    },
    validateLayoutTemplate: function (c) {
        var b = dojo.filter(c.parameters, function (e, d) {
            return e.name === "Layout_Template"
        });
        this.templateNames = b[0].choiceList;
        if (this.layoutTemplate === null) {
            if (b[0].defaultValue == "") {
                this.layoutTemplate = ""
            } else {
                this.layoutTemplate = b[0].defaultValue
            }
        } else {
            if (!Ext.Array.contains(this.templateNames, this.layoutTemplate)) {
                this.failure(this.generateExtError(app.locale.i18n("PrintMapUtilityInvalidLayoutTemplate"), ca.esri.core.tool.printmap.PrintMapUtility.errorCodes.INVALIDLAYOUTTEMPLATE));
                Ext.Error.raise({
                    msg: app.locale.i18n("PrintMapUtilityInvalidLayoutTemplate")
                })
            }
        }
    },
    resetVisibleLayers: function () {
        for (var c = 0; c < this.map.layerIds.length; c++) {
            var b = this.map.getLayer(this.map.layerIds[c]);
            if (b instanceof esri.layers.ArcGISDynamicMapServiceLayer) {
                b.setVisibleLayers(b.visibleLayers)
            }
        }
    },
    runESRIPrintTask: function () {
        var d = new esri.tasks.PrintTask(this.printTaskUrl, {
            async: true
        });
        var e = new esri.tasks.PrintParameters();
        e.map = this.map;
        var b = this.getLegendLayers();
        var c = new esri.tasks.PrintTemplate();
        c.format = "PDF";
        c.layout = this.layoutTemplate;
        c.layoutOptions = {
            titleText: this.titleText,
            authorText: window.location.href,
            legendLayers: b
        };
        c.preserveScale = false;
        if (this.layoutTemplate === "MAP_ONLY") {
            c.exportOptions = {
                width: this.map.width,
                height: this.map.height,
                dpi: 96
            }
        } else {
            c.exportOptions = {
                dpi: 151
            }
        }
        e.template = c;
        d.execute(e, dojo.hitch(this, this.cbPrintTaskOnComplete), dojo.hitch(this, this.cbPrintTaskOnError));
        setTimeout(dojo.hitch(this, function () {
            if (this.isPrintTaskComplete != true) {
                this.cbPrintTaskOnError(new Error(app.locale.i18n("PrintMapUtilitySetTimeoutError")))
            }
        }), 180000)
    },
    cbPrintTaskOnComplete: function (b) {
        this.isPrintTaskComplete = true;
        if (this.layoutTemplate === "MAP_ONLY") {
            this.success(b.url)
        } else {
            this.resizePDF(b.url)
        }
    },
    cbPrintTaskOnError: function (b) {
        this.isPrintTaskComplete = true;
        this.failure(this.generateExtError(b.message, ca.esri.core.tool.printmap.PrintMapUtility.errorCodes.PRINTTASKFAILED))
    },
    getLegendLayers: function () {
        var b = [];
        for (var e = 0; e < this.map.layerIds.length; e++) {
            var g = this.map.getLayer(this.map.layerIds[e]);
            if (g instanceof esri.layers.ArcGISDynamicMapServiceLayer) {
                if (g.visibleLayers[0] == -1) {
                    continue
                }
                var m = g.layerInfos;
                var d = [];
                for (var c = 0; c < g.visibleLayers.length; c++) {
                    var h = m[g.visibleLayers[c]];
                    while (h.parentLayerId != -1) {
                        if (Ext.Array.indexOf(d, h.id) == -1) {
                            d.push(h.id)
                        }
                        h = m[h.parentLayerId]
                    }
                    if (Ext.Array.indexOf(d, h.id) == -1) {
                        d.push(h.id)
                    }
                }
                var f = new esri.tasks.LegendLayer();
                f.layerId = g.id;
                f.subLayerIds = d;
                b.push(f)
            }
        }
        return b
    },
    resizePDF: function (b) {
        Ext.Ajax.request({
            url: this.pdfResizeUrl,
            params: "lang=" + dojo.locale + "&pdfUrl=" + b,
            method: "POST",
            scope: this,
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "Cache-Control": "no-cache",
                Accept: "application/json"
            },
            success: function (c, d) {
                var e = Ext.JSON.decode(c.responseText, true);
                if (e === null) {
                    this.failure(this.generateExtError(app.locale.i18n("PrintMapUtilityPdfResizeFailedResponseJSON"), ca.esri.core.tool.printmap.PrintMapUtility.errorCodes.PDFRESIZERESPONSEJSONERROR));
                    return
                } else {
                    if (e.success == false) {
                        this.failure(this.generateExtError(e.message, ca.esri.core.tool.printmap.PrintMapUtility.errorCodes.PDFRESIZEFALSEPOSITIVE));
                        return
                    }
                }
                this.success(app.WS_OUTPUT + e.url)
            },
            failure: function (c, d) {
                this.failure(this.generateExtError(app.locale.i18n("PrintMapUtilityPdfResizeFailed"), ca.esri.core.tool.printmap.PrintMapUtility.errorCodes.PDFRESIZEFAILED));
                return
            }
        })
    },
    generateExtError: function (c, b) {
        return new Ext.Error({
            msg: c,
            errorCode: b
        })
    },
    destroy: function () {
        if (this.printTaskOnCompleteHandle != null) {
            dojo.disconnect(this.printTaskOnCompleteHandle);
            this.printTaskOnCompleteHandle.remove();
            this.printTaskOnCompleteHandle = null
        }
        if (this.printTaskOnErrorHandle != null) {
            dojo.disconnect(this.printTaskOnErrorHandle);
            this.printTaskOnErrorHandle.remove();
            this.printTaskOnErrorHandle = null
        }
        this.callParent(arguments)
    }
});
Ext.define("ca.esri.core.tool.printmap.Window", {
    extend: "Ext.window.Window",
    id: "PrintMapWindow",
    constrainHeader: true,
    shadow: false,
    collapsible: true,
    bodyPadding: 7,
    margin: 3,
    resizable: true,
    defaults: {
        style: {
            margin: "3px"
        }
    },
    uses: ["ca.esri.core.tool.printmap.PrintMapUtility"],
    // tools: [{
        // type: "help",
        // handler: function (d, e, b, c) {
            // app.openHelp(app.HELP_ROOT + "#prt")
        // }
    // }],
    width: 425,
    height: 166,
    layout: "border",
    panel: null,
    button: null,
    templateStore: null,
    printingMask: null,
    mapTitleDefault: "",
    initComponent: function () {
        this.callParent(arguments);
        this.title = app.locale.i18n("PrintMapWindowTitle");
        if (app.locale.i18n("ApplicationTitle") == "ApplicationTitle") {
            this.mapTitleDefault = app.locale.i18n("PrintMapWindowPanelTitleEmptyText")
        } else {
            this.mapTitleDefault = app.locale.i18n("ApplicationTitle")
        }
        this.panel = Ext.create("Ext.panel.Panel", {
            id: "PrintMapWindowPanel",
            region: "center",
            layout: "fit",
            items: [{
                xtype: "container",
                padding: 5,
                autoScroll: true,
                layout: {
                    type: "vbox",
                    align: "stretch"
                },
                items: [{
                    xtype: "textfield",
                    id: "PrintMapWindowPanelTitle",
                    fieldLabel: app.locale.i18n("PrintMapWindowPanelTitle"),
                    allowBlank: false,
                    value: this.mapTitleDefault,
                    wcagTitle: app.locale.i18n("PrintMapWindowPanelTitle")
                }, {
                    xtype: "combobox",
                    id: "PrintMapWindowPanelTemplates",
                    fieldLabel: app.locale.i18n("PrintMapWindowPanelTemplates"),
                    valueField: "PrintMapTemplateValuesField",
                    displayField: "PrintMapTemplateDisplayField",
                    queryMode: "local",
                    editable: false,
                    wcagTitle: app.locale.i18n("PrintMapWindowPanelTemplates")
                }]
            }]
        });
        this.container = Ext.create("Ext.container.Container", {
            id: "PrintMapWindowContainerPrint",
            region: "south",
            items: [{
                xtype: "button",
                id: "PrintMapWindowPrint",
                text: app.locale.i18n("PrintMapWindowPrint"),
                handler: this.printMapTask,
                scope: this,
                tooltip: app.locale.i18n("PrintMapWindowPrintTooltip"),
                tooltipType: "title"
            }, {
                xtype: "label",
                id: "PrintMapWindowText",
                text: "(" + app.locale.i18n("PrintMapWindowPrintTooltip") + ")",
                padding: 5,
                style: {
                    fontSize: "85%"
                }
            }]
        });
        this.add(this.panel);
        this.add(this.container);
        this.printingMask = new Ext.LoadMask(this, {
            msg: app.locale.i18n("PrintMapWindowPrintingMask")
        });
        this.on("afterrender", this.onAfterRender)
    },
    onAfterRender: function (d, c) {
        var b = esri.request({
            url: app.locale.i18n("PrintMapPrintUrl"),
            content: {
                f: "json"
            }
        });
        b.then(dojo.hitch(this, this.populateTemplatesComboBox), this.populateTemplatesComboBoxError);
        this.un("afterrender", this.onAfterRender)
    },
    populateTemplatesComboBox: function (h) {
        var e = dojo.filter(h.parameters, function (k, j) {
            return k.name === "Layout_Template"
        });
        if (e.length == 0) {
            console.log('print service parameters name for templates must be "Layout_Template"');
            return
        }
        var b = e[0].choiceList;
        var f = Ext.Array.indexOf(b, "MAP_ONLY");
        if (f > -1) {
            var d = b.splice(f, f + 1)[0];
            b.push(d)
        }
        Ext.define("PrintMapTemplateNamesModel", {
            extend: "Ext.data.Model",
            fields: [{
                name: "PrintMapTemplateValuesField",
                type: "string"
            }, {
                name: "PrintMapTemplateDisplayField",
                type: "string"
            }]
        });
        var c = dojo.map(b, function (j) {
            if (j == "MAP_ONLY") {
                return {
                    PrintMapTemplateValuesField: j,
                    PrintMapTemplateDisplayField: app.locale.i18n("PrintMapWindowPanelTemplatesMapOnlyDisplay")
                }
            } else {
                return {
                    PrintMapTemplateValuesField: j,
                    PrintMapTemplateDisplayField: j
                }
            }
        });
        this.templateStore = Ext.create("Ext.data.Store", {
            id: "PrimtMapTemplateNamesStore",
            model: "PrintMapTemplateNamesModel",
            fields: ["PrintMapTemplateValuesField", "PrintMapTemplateDisplayField"]
        });
        var g = Ext.getCmp("PrintMapWindowPanelTemplates");
        this.templateStore.loadData(c);
        g.bindStore(this.templateStore);
        g.setValue("Portrait")
    },
    populateTemplatesComboBoxError: function (b) {
        alert(app.locale.i18n("ErrorMsg") + b.message)
    },
    printMapTask: function () {
        this.printingMask.show();
        var b = Ext.getCmp("PrintMapWindowPanelTitle");
        if (b.getValue() == "") {
            b.setValue(this.mapTitleDefault)
        }
        var c = Ext.create("ca.esri.core.tool.printmap.PrintMapUtility", {
            map: app.map,
            titleText: b.getValue(),
            layoutTemplate: Ext.getCmp("PrintMapWindowPanelTemplates").getValue(),
            printTaskUrl: app.locale.i18n("PrintMapPrintUrl"),
            pdfResizeUrl: app.locale.i18n("PrintMapPdfResizeUrl"),
            success: function (d) {
                Ext.getCmp("PrintMapWindow").printingMask.hide();
                window.open(d)
            },
            failure: function (d) {
                Ext.getCmp("PrintMapWindow").printingMask.hide();
                Ext.Msg.alert(app.locale.i18n("ErrorMsg") + d.errorCode, d.msg)
            }
        });
        c.execute()
    },
    destroy: function () {
        if (this.panel != null) {
            this.panel.destroy();
            this.panel = null
        }
        this.callParent(arguments)
    }
});
Ext.define("ca.esri.core.tool.printmap.locale.en", {
    addStrings: function () {
        app.locale.add("PrintMapWindowTitle", "Print Map");
        app.locale.add("PrintMapWindowPrintingMask", "Printing (may take a while)...");
        app.locale.add("PrintMapText", "Print");
        app.locale.add("PrintMapTooltip", "Print this map");
        app.locale.add("PrintMapPrintUrl", app.AGS_RESTSERVICES + "tools_outils/AAFCPrintMapTask_EN/GPServer/Export%20Web%20Map");
        app.locale.add("PrintMapPdfResizeUrl", app.WL_DOMAIN + "PrintWebService/ws/print/ags");
        app.locale.add("PrintMapWindowPanelHeader", "Fill out details to include in the layout...");
        app.locale.add("PrintMapWindowPanelTitle", "Map title");
        app.locale.add("PrintMapWindowPanelTemplates", "Choose template");
        app.locale.add("PrintMapWindowPanelTemplatesMapOnlyDisplay", "Map only");
        app.locale.add("PrintMapWindowPanelExportType", "Choose export type");
        app.locale.add("PrintMapWindowPrint", "Print to PDF");
        app.locale.add("PrintMapWindowPrintTooltip", "Opens in a new window");
        app.locale.add("PrintMapWindowPanelTitleEmptyText", "<enter title>");
        app.locale.add("PrintMapUtilityConfigMapError", "Must provide a map reference.");
        app.locale.add("PrintMapUtilityConfigTitleTextError", "Must provide a value for titleText.");
        app.locale.add("PrintMapUtilityConfigLayoutTemplateMessage", "layoutTemplate set to default for print service at printTaskURL");
        app.locale.add("PrintMapUtilityConfigPrintTaskUrlMessage", "printTaskUrl set to default for application");
        app.locale.add("PrintMapUtilityConfigPdfResizeUrlMessage", "pdfResizeUrl set to default for application");
        app.locale.add("PrintMapUtilityConfigSuccessCallbackError", "Must provide a success callback function.");
        app.locale.add("PrintMapUtilityConfigFailureCallbackError", "Must provide a failure callback function.");
        app.locale.add("PrintMapUtilityInvalidLayoutTemplate", "The layoutTemplate specified could not be found at the printTaskUrl. Check the Print Services REST endpoint for available Layout templates.");
        app.locale.add("PrintMapUtilityPdfResizeFailedResponseJSON", "responseJSON is null or invalid.");
        app.locale.add("PrintMapUtilityPdfResizeFailed", "Pdf Resize service failed.");
        app.locale.add("PrintMapUtilitySetTimeoutError", "Print task exceeded 3 minute time limit.<br>Releasing control to the Print map interface.")
    }
});
Ext.define("ca.esri.core.tool.printmap.locale.fr", {
    addStrings: function () {
        app.locale.add("PrintMapWindowTitle", "Imprimer cette carte");
        app.locale.add("PrintMapWindowPrintingMask", "En impression (peut prendre un certain temps)...");
        app.locale.add("PrintMapText", "Imprimer");
        app.locale.add("PrintMapTooltip", "Imprimer cette carte");
        app.locale.add("PrintMapPrintUrl", app.AGS_RESTSERVICES + "tools_outils/AAFCPrintMapTask_FR/GPServer/Export%20Web%20Map");
        app.locale.add("PrintMapPdfResizeUrl", app.WL_DOMAIN + "PrintWebService/ws/print/ags");
        app.locale.add("PrintMapWindowPanelHeader", "Inclure des détails pour la mise en page...");
        app.locale.add("PrintMapWindowPanelTitle", "Titre de la carte");
        app.locale.add("PrintMapWindowPanelTemplates", "Choisir le modèle");
        app.locale.add("PrintMapWindowPanelTemplatesMapOnlyDisplay", "Carte seulement");
        app.locale.add("PrintMapWindowPanelExportType", "Choisir le type d'exportation");
        app.locale.add("PrintMapWindowPrint", "Imprimer en format PDF");
        app.locale.add("PrintMapWindowPrintTooltip", "Ouvrir dans une nouvelle fenêtre");
        app.locale.add("PrintMapWindowPanelTitleEmptyText", "Entrer le titre");
        app.locale.add("PrintMapUtilityConfigMapError", "Une référence de carte doit être spécifiée.");
        app.locale.add("PrintMapUtilityConfigTitleTextError", "Une valeur doit être spécifiée pour titleText.");
        app.locale.add("PrintMapUtilityConfigLayoutTemplateMessage", "layoutTemplate est défini par défaut pour le service d'impression à printTaskURL");
        app.locale.add("PrintMapUtilityConfigPrintTaskUrlMessage", "printTaskUrl est défini par défaut pour l'application.");
        app.locale.add("PrintMapUtilityConfigPdfResizeUrlMessage", "pdfResizeUrl est défini par défaut pour l'application.");
        app.locale.add("PrintMapUtilityConfigSuccessCallbackError", "Une fonction de rappel de succès doit être fournie.");
        app.locale.add("PrintMapUtilityConfigFailureCallbackError", "Une fonction de rappel d'échec doit être fournie.");
        app.locale.add("PrintMapUtilityInvalidLayoutTemplate", "Le layoutTemplate spécifié n'a pu être trouvé à printTaskUrl. Vérifier la fin du fichier REST du service d'impression pour voir les modèles de mise en page disponibles.");
        app.locale.add("PrintMapUtilityPdfResizeFailedResponseJSON", "responseJSON est nul ou invalide.");
        app.locale.add("PrintMapUtilityPdfResizeFailed", "Le service de redimensionnement Pdf a échoué.");
        app.locale.add("PrintMapUtilitySetTimeoutError", "La tâche d'impression a excédé le temps limite de 3 minutes.<br>Remise du contrôle à l'interface d'impression de la carte.")
    }
});
Ext.define("ca.esri.core.tool.zoomfull.locale.en", {
    addStrings: function () {
        app.locale.add("Zoom2InitialExtentsTooltip", "Zoom to full view")
    }
});
Ext.define("ca.esri.core.tool.zoomfull.locale.fr", {
    addStrings: function () {
        app.locale.add("Zoom2InitialExtentsTooltip", "{fr}Zoom to full view")
    }
});
Ext.define("ca.esri.core.util.Format", {
    currency: function (c) {
        var d;
        switch (dojo.locale) {
        case "fr":
            var b = false;
            d = c;
            if (c < 0) {
                b = true;
                d = Math.abs(c)
            }
            d = Ext.util.Format.usMoney(d);
            d = d.replace(/\./g, " ");
            d = d.replace(/\$/, "");
            d = d + " $";
            if (b) {
                d = "(" + d + ")"
            }
            break;
        default:
            d = Ext.util.Format.usMoney(c);
            break
        }
        return d
    },
    number: function (b) {
        switch (dojo.locale) {
        case "en":
            return this.addSeparatorsNF(b, ".", ".", ",");
            break;
        case "fr":
            return this.addSeparatorsNF(b, ".", ",", " ");
            break
        }
    },
    addSeparatorsNF: function (e, f, b, d) {
        e += "";
        var g = e.indexOf(f);
        var h = "";
        if (g != -1) {
            h = b + e.substring(g + 1, e.length);
            e = e.substring(0, g)
        }
        var c = /(\d+)(\d{3})/;
        while (c.test(e)) {
            e = e.replace(c, "$1" + d + "$2")
        }
        return e + h
    }
});
Ext.define("ca.esri.core.esristore.mapservice.Layers", {
    extend: "Ext.data.Store",
    model: "ca.esri.core.esrimodel.mapservice.Layers",
    constructor: function (b) {
        this.proxy.url = b.url;
        delete b.url;
        this.initConfig(b);
        this.callParent([b])
    },
    proxy: {
        type: "jsonp",
        reader: {
            type: "json",
            root: "layers"
        }
    }
});
Ext.define("ca.esri.core.esristore.mapservicelayer.Fields", {
    extend: "Ext.data.Store",
    model: "ca.esri.core.esrimodel.mapservicelayer.Fields",
    constructor: function (b) {
        this.proxy.url = b.url;
        delete b.url;
        this.initConfig(b);
        this.callParent([b])
    },
    proxy: {
        type: "jsonp",
        reader: {
            type: "json",
            root: "fields"
        }
    },
    filters: [function (b) {
        if (b.get("alias").toLowerCase().indexOf("objectid") === -1 && b.get("alias").toLowerCase().indexOf("fid") === -1 && b.get("alias").toLowerCase().indexOf("_id") === -1 && b.get("alias").toLowerCase().indexOf("shape") === -1) {
            return b
        }
    }]
});
Ext.define("ca.esri.core.locale.en", {
    extend: "ca.esri.core.Locale",
    addStrings: function () {
        this.add("labelSeparator", ": ");
        this.add("ErrorMsg", "Error: ");
        this.add("ErrorUnknown", "An unknown error occurred");
        this.add("ErrorServiceDown", "A required service is down");
        this.add("LoadMaskText", "Loading...");
        this.add("HelpToolAltText", "How to use this panel (opens in a new window)");
        this.add("CollapseToolAltText", "Expand/collapse this panel");
        this.add("CloseToolAltText", "Close");
        this.add("GeocoderTitle", "Search");
        this.add("GeocoderTooltip", "Find address or place");
        this.add("GeocoderMask", "Searching...");
        this.add("GeocoderNoResults", "No results were found within the map's extents for '{0}'.<br />Try narrowing your criteria and searching again.")
    }
});
Ext.define("ca.esri.core.locale.fr", {
    extend: "ca.esri.core.Locale",
    addStrings: function () {
        this.add("labelSeparator", " : ");
        this.add("ErrorMsg", "Erreur : ");
        this.add("ErrorUnknown", "Une erreur inconnue s'est produite");
        this.add("ErrorServiceDown", "Un service requis est en panne");
        this.add("LoadMaskText", "En cours de chargement...");
        this.add("HelpToolAltText", "Comment utiliser cet écran (s'ouvre dans une nouvelle fenêtre)");
        this.add("CollapseToolAltText", "Agrandir/réduire cet écran");
        this.add("CloseToolAltText", "Fermer");
        this.add("GeocoderTitle", "Recherche");
        this.add("GeocoderTooltip", "Rechercher une adresse ou un lieu");
        this.add("GeocoderMask", "Recherche...");
        this.add("GeocoderNoResults", "Aucun résultat n'a été trouvé à l'intérieur des limites de la carte pour '{0}'.<br />Préciser votre critère et chercher de nouveau.")
    }
});
Ext.define("ca.esri.core.tool.about.ToolbarButton", {
    extend: "ca.esri.core.tool.ToolbarButton",
    uses: ["ca.esri.core.tool.about.locale." + dojo.locale, "ca.esri.core.tool.about.Window"],
    side: "right",
    textKey: "AboutText",
    tooltipKey: "AboutTooltip",
    winLcl: "ca.esri.core.tool.about.locale.",
    winCls: "ca.esri.core.tool.about.Window",
    cls: "no-icon-toolbarbutton",
    urls: null,
    initComponent: function () {
        if (this.urls === null) {
            this.urls = []
        }
        this.urls.push({
            titleKey: "AboutDisclaimer",
            url: app.APP_ROOT + "/../Disclaimer.html"
        });
        this.winCfg = {
            urls: this.urls
        };
        this.callParent(arguments)
    }
});
Ext.define("ca.esri.core.tool.addlayer.Window", {
    extend: "Ext.window.Window",
    uses: ["ca.esri.core.tool.addlayer.AddData"],
    id: "AddLayerWindow",
    constrainHeader: true,
    shadow: false,
    collapsible: true,
    bodyPadding: 7,
    margin: 3,
    defaults: {
        style: {
            margin: "3px"
        }
    },
    // tools: [{
        // type: "help",
        // handler: function (d, e, b, c) {
            // app.openHelp(app.HELP_ROOT + "#add")
        // }
    // }],
    layout: "border",
    width: 500,
    height: 230,
    radioPanel: null,
    filePanel: null,
    urlPanel: null,
    panel: null,
    submitContainer: null,
    loadMask: null,
    loadMaskCounter: 0,
    addData: null,
    initComponent: function () {
        this.callParent(arguments);
        this.title = app.locale.i18n("AddLayerTitle");
        this.loadMask = new Ext.LoadMask(this, {
            msg: app.locale.i18n("AddLayerLoadMask")
        });
        this.radioPanel = Ext.create("Ext.form.Panel", {
            id: "RadioPanel",
            border: false,
            items: [{
                xtype: "radiogroup",
                columns: 1,
                vertical: true,
                margin: 15,
                items: [{
                    boxLabel: app.locale.i18n("AddLayerSelectAgs"),
                    name: "rb",
                    checked: true,
                    inputValue: "arcgis",
                    listeners: {
                        change: this.radioChecked,
                        scope: this
                    }
                }, {
                    boxLabel: app.locale.i18n("AddLayerSelectWms"),
                    name: "rb",
                    inputValue: "wms",
                    listeners: {
                        change: this.radioChecked,
                        scope: this
                    }
                }, {
                    boxLabel: app.locale.i18n("AddLayerSelectShp"),
                    name: "rb",
                    inputValue: "shapefile",
                    listeners: {
                        change: this.radioChecked,
                        scope: this
                    }
                }]
            }]
        });
        this.urlPanel = Ext.create("Ext.panel.Panel", {
            id: "UrlPanel",
            autoScroll: true,
            padding: "0 0 0 25",
            border: false,
            height: 40,
            layout: {
                type: "hbox",
                align: "top"
            },
            items: [{
                xtype: "textfield",
                id: "MapServiceUrl",
                name: "MapServiceUrl",
                fieldLabel: app.locale.i18n("AddLayerUrlLabel"),
                wcagTitle: app.locale.i18n("AddLayerUrlLabel"),
                value: "http://<" + app.locale.i18n("AddLayerUrlEmptyText") + ">",
                growMin: 200,
                growMax: 1000,
                grow: true,
                listeners: {
                    focus: function () {
                        if (this.getValue().indexOf(app.locale.i18n("AddLayerUrlEmptyText")) !== -1) {
                            this.setValue("")
                        }
                    },
                    specialkey: function (c, b) {
                        if (b.getKey() === b.RETURN || b.getKey() === b.ENTER) {
                            Ext.getCmp("AddLayerSubmitButton").fireEvent("click", this)
                        }
                    }
                }
            }]
        });
        this.filePanel = Ext.create("Ext.form.Panel", {
            id: "FilePanel",
            autoScroll: true,
            padding: "0 0 0 25",
            border: false,
            layout: {
                type: "hbox",
                align: "stretch"
            },
            items: [{
                xtype: "fileuploadfield",
                id: "ShpPath",
                name: "file",
                fieldLabel: app.locale.i18n("AddLayerFileLabel"),
                wcagTitle: app.locale.i18n("AddLayerFileLabel"),
                buttonText: app.locale.i18n("AddLayerFileChoose")
            }]
        });
        this.panel = Ext.create("Ext.panel.Panel", {
            id: "AddLayerWindowPanel",
            autoScroll: true,
            region: "center",
            items: [this.radioPanel, this.urlPanel]
        });
        this.submitContainer = Ext.create("Ext.container.Container", {
            id: "AddLayerSubmitPanel",
            autoScroll: true,
            region: "south",
            border: false,
            items: [{
                xtype: "button",
                id: "AddLayerSubmitButton",
                text: app.locale.i18n("AddLayerSubmitButton"),
                listeners: {
                    click: {
                        fn: this.clickSubmit,
                        scope: this
                    }
                }
            }]
        });
        this.add(this.panel);
        this.add(this.submitContainer)
    },
    destroy: function () {
        if (this.urlPanel !== null) {
            this.urlPanel.destroy();
            this.urlPanel = null
        }
        if (this.filePanel !== null) {
            this.filePanel.destroy();
            this.filePanel = null
        }
        if (this.radioPanel !== null) {
            this.radioPanel.destroy();
            this.radioPanel = null
        }
        if (this.panel !== null) {
            this.panel.destroy();
            this.panel = null
        }
        if (this.addData != null) {
            this.addData.destroy();
            this.addData = null
        }
        this.callParent(arguments)
    },
    errorHandler: function (b) {
        alert(app.locale.i18n("ErrorMsg") + this.$className + " - " + b.message)
    },
    clickSubmit: function () {
        var b = Ext.getCmp("MapServiceUrl").getValue();
        var d = Ext.getCmp("ShpPath").getValue();
        var e = this.radioPanel.items.items[0].getValue().rb;
        this.addData = Ext.create("ca.esri.core.tool.addlayer.AddData", {
            success: dojo.hitch(this, this.handleSuccessAddingLayer),
            failure: dojo.hitch(this, this.handleErrorAddingLayer)
        });
        this.showMask();
        if (e === "arcgis") {
            this.addData.addMapService(b)
        } else {
            if (e === "wms") {
                this.addData.addWms(b)
            } else {
                try {
                    var f = /(.+\\)*(.+)*\.zip$/i.exec(d)[2];
                    this.addData.addShp(f, Ext.getCmp("FilePanel"))
                } catch (c) {
                    Ext.Msg.alert(app.locale.i18n("AddLayerErrorDialogTitle"), app.locale.i18n("AddLayerErrorParseFilename"));
                    this.hideMask();
                    return
                }
            }
        }
    },
    handleSuccessAddingLayer: function () {
        this.hideMask();
        this.showLayerList()
    },
    handleErrorAddingLayer: function (c) {
        this.hideMask();
        var b = this.addData.getErrorAddingLayerMessage(c);
        Ext.Msg.alert(app.locale.i18n("AddLayerErrorDialogTitle"), b)
    },
    radioChecked: function (b, c, d) {
        switch (b.inputValue) {
        case "wms":
        case "arcgis":
            if (c) {
                this.panel.remove(this.filePanel, false);
                this.panel.remove(this.urlPanel, false);
                this.panel.add(this.urlPanel);
                Ext.getCmp("AddLayerSubmitButton").enable()
            }
            break;
        case "shapefile":
            if (c) {
                this.panel.remove(this.filePanel, false);
                this.panel.remove(this.urlPanel, false);
                this.panel.add(this.filePanel);
                Ext.getCmp("AddLayerSubmitButton").enable()
            }
            break;
        default:
        }
    },
    showMask: function () {
        this.loadMaskCounter++;
        this.loadMask.show()
    },
    hideMask: function () {
        if (--this.loadMaskCounter < 0) {
            this.loadMaskCounter = 0
        }
        if (this.loadMaskCounter === 0) {
            this.loadMask.hide()
        }
    },
    showLayerList: function () {
        Ext.each(app.toolbar.items.items, function (b) {
            if (b instanceof ca.esri.core.tool.layerlist.ToolbarButton) {
                b.handler(b)
            }
        }, this)
    },
    parseEsriPortalError: function (b) {
        if (/maximum/i.test(b) && /record/i.test(b) && /allow/i.test(b)) {
            return app.locale.i18n("AddLayerErrorMaxRecordsReached")
        } else {
            if (/invalid/i.test(b) && /shapefile/i.test(b)) {
                return app.locale.i18n("AddLayerErrorInvalidShapefile")
            } else {
                if (/invalid/i.test(b) && /archive/i.test(b)) {
                    return app.locale.i18n("AddLayerErrorInvalidZipFile")
                }
            }
        }
    }
});
Ext.define("ca.esri.core.tool.bookmarks.ToolbarButton", {
    extend: "ca.esri.core.tool.ToolbarButton",
    uses: ["ca.esri.core.tool.bookmarks.locale." + dojo.locale, "ca.esri.core.tool.bookmarks.Window"],
    iconCls: "icon-bookmark",
    textKey: "BookmarksText",
    tooltipKey: "BookmarksTooltip",
    winLcl: "ca.esri.core.tool.bookmarks.locale.",
    winCls: "ca.esri.core.tool.bookmarks.Window",
    constructor: function (b) {
        Ext.create("ca.esri.core.tool.bookmarks.locale." + dojo.locale).addStrings();
        this.tooltip = app.locale.i18n("BookmarksTooltip");
        this.initConfig(b);
        this.callParent([b])
    }
});
Ext.define("ca.esri.core.tool.changebasemap.ToolbarButton", {
    extend: "ca.esri.core.tool.ToolbarButton",
    uses: ["ca.esri.core.tool.changebasemap.locale." + dojo.locale, "ca.esri.core.tool.changebasemap.Window"],
    iconCls: "icon-changebasemap",
    textKey: "ChangeBasemapText",
    tooltipKey: "ChangeBasemapTooltip",
    winLcl: "ca.esri.core.tool.changebasemap.locale.",
    winCls: "ca.esri.core.tool.changebasemap.Window",
    mapOnLayersAddResultHandler: null,
    mapOnBasemapChangeHandler: null,
    esriBasemapGalleryCss: [".ie7 .esriBasemapGallerySelectedNode .esriBasemapGalleryThumbnail {", "  border-bottom: 0px;", "  border-top: 0px;", "}", "div.esriBasemapGalleryNode{", "  margin: 5px 10px;", "}", "div.esriBasemapGalleryLabelContainer{", "  overflow: visible;", "}"].join(""),
    constructor: function (b) {
        this.initConfig(b);
        this.callParent([b]);
        this.relayEvents(app, ["mapCreated"]);
        this.on("mapCreated", this.onMapCreated, this);
        Ext.util.CSS.createStyleSheet(this.esriBasemapGalleryCss, "esriBasemapGalleryCss")
    },
    onMapCreated: function (b) {
        this.mapOnLayersAddResultHandler = dojo.connect(b, "onLayersAddResult", this, function (d) {
            for (var c = 0; c < d.length; c++) {
                if (d[c].layer.hasOwnProperty("basemapGalleryLayerType")) {
                    d[c].layer._basemapGalleryLayerType = d[c].layer.basemapGalleryLayerType
                }
            }
        })
    },
    destroy: function () {
        alert(this.$className + ".destroy - Is this ever happening?");
        dojo.disconnect(this.mapOnLayersAddResultHandler);
        this.mapOnLayersAddResultHandler.remove();
        this.mapOnLayersAddResultHandler = null;
        dojo.disconnect(this.mapOnBasemapChangeHandler);
        this.mapOnBasemapChangeHandler.remove();
        this.mapOnBasemapChangeHandler = null;
        Ext.util.CSS.removeStyleSheet("esriBasemapGalleryCss");
        this.callParent(arguments)
    }
});
Ext.define("ca.esri.core.tool.help.ToolbarButton", {
    extend: "ca.esri.core.tool.ToolbarButton",
    uses: ["ca.esri.core.tool.help.locale." + dojo.locale],
    side: "right",
    textKey: "HelpText",
    tooltipKey: "HelpTooltip",
    winLcl: "ca.esri.core.tool.help.locale.",
    cls: "no-icon-toolbarbutton",
    helpUrl: null,
    handler: function (c, b) {
        app.openHelp(this.helpUrl)
    }
});
Ext.define("ca.esri.core.tool.layerlist.ContextMenu", {
    extend: "Ext.menu.Menu",
    uses: ["ca.esri.core.tool.layerlist.WindowOpacity"],
    view: null,
    rec: null,
    node: null,
    index: null,
    event: null,
    callingPanel: null,
    initComponent: function () {
        var b = this.buildContextMenu();
        if (b.length === 0) {
            return
        }
        Ext.apply(this, {
            plain: true,
            defaults: {
                cls: "no-icon-menu",
                scope: this
            },
            items: b
        });
        this.callParent(arguments)
    },
    onAfterRender: function (c, b) {
        new Ext.util.KeyMap(this.id, {
            key: Ext.EventObject.ESC,
            fn: function (e, d) {
                c.event.target.focus()
            }
        })
    },
    buildContextMenu: function () {
        var c;
        var b = [];
        if (this.rec.raw.service) {
            if (this.rec.previousSibling) {
                c = false;
                if (this.rec.raw.service._basemapGalleryLayerType && this.rec.raw.service._basemapGalleryLayerType === "basemap") {
                    c = true
                }
                b.push({
                    text: app.locale.i18n("LayerListMoveUp"),
                    disabled: c,
                    handler: this.onMoveUp,
                    scope: this
                })
            }
            if (this.rec.nextSibling) {
                c = false;
                if (this.rec.nextSibling.raw.service._basemapGalleryLayerType && this.rec.nextSibling.raw.service._basemapGalleryLayerType === "basemap") {
                    c = true
                }
                b.push({
                    text: app.locale.i18n("LayerListMoveDown"),
                    disabled: c,
                    handler: this.onMoveDown,
                    scope: this
                })
            }
            if (b.length > 0) {
                b.push({
                    xtype: "menuseparator"
                })
            }
        }
        if (this.rec.raw.service) {
            c = false;
            if (this.rec.raw.service._basemapGalleryLayerType) {
                c = true
            }
            b.push({
                text: app.locale.i18n("LayerListRemove"),
                disabled: c,
                handler: function (e, d) {
                    Ext.Msg.confirm(app.locale.i18n("LayerListRemoveService"), app.locale.i18n("LayerListRemoveConfirm"), this.onRemove, this)
                }
            });
            b.push({
                text: app.locale.i18n("LayerListOpacity"),
                handler: this.setOpacity,
                scope: this
            })
        }
        if (this.rec.raw.hasMetadata) {
            b.push({
                text: app.locale.i18n("LayerListViewMetadata"),
                handler: this.viewMetadata,
                scope: this
            })
        }
        return b
    },
    onRemove: function (c, b) {
        if (c === "yes") {
            app.map.removeLayer(this.rec.raw.service)
        }
    },
    onMoveUp: function (f, c) {
        var b = this.rec.parentNode;
        var e = this.rec.previousSibling;
        var d = b.removeChild(this.rec);
        b.insertBefore(d, e);
        var g = Ext.Array.indexOf(this.callingPanel.getIdsArray(), e.raw.service.id);
        app.map.reorderLayer(this.rec.raw.service, g)
    },
    onMoveDown: function (e, c) {
        var b = this.rec.parentNode;
        var f = this.rec.nextSibling;
        var g;
        var d = b.removeChild(this.rec);
        if (f.nextSibling) {
            g = Ext.Array.indexOf(this.callingPanel.getIdsArray(), f.raw.service.id);
            b.insertBefore(d, f.nextSibling)
        } else {
            g = 0;
            b.appendChild(d)
        }
        app.map.reorderLayer(this.rec.raw.service, g)
    },
    setOpacity: function (d, b) {
        var e = Ext.getCmp("OpacityWindow");
        if (e != null) {
            e.destroy();
            e = null
        }
        e = Ext.create("ca.esri.core.tool.layerlist.WindowOpacity", {
            service: this.rec.raw.service
        });
        var c = b.target.getBoundingClientRect();
        e.showAt([c.right, c.bottom])
    },
    getService: function (c) {
        var b = c.parentNode;
        while (!b.isRoot()) {
            c = b;
            b = c.parentNode
        }
        return c.raw.service
    },
    viewMetadata: function (e, c) {
        var b = this.getService(this.rec);
        var d = Ext.create("ca.esri.core.MetadataTranslator");
        d.getTranslatedUrl(b.url + "/" + this.rec.raw.id, function (f) {
            window.open(f)
        }, function (f) {
            console.log(f);
            if (!f) {
                Ext.Msg.alert(app.locale.i18n("ErrorMsg"), app.locale.i18n("ErrorUnknown"))
            }
            switch (f.errorCode) {
            case d.errorCodes.CANTCONNECTSOE:
                Ext.Msg.alert(app.locale.i18n("ErrorMsg"), app.locale.i18n("ErrorServiceDown"));
                break;
            case d.errorCodes.INVALIDMETADATA:
                alert("Dataset does not have Geoportal a ID! Either fix it on the dataset or disable the MetadataSOE");
                break;
            case d.errorCodes.UNKNOWN:
            default:
                Ext.Msg.alert(app.locale.i18n("ErrorMsg"), app.locale.i18n("ErrorUnknown"))
            }
        })
    }
});
Ext.define("ca.esri.core.tool.legend.ToolbarButton", {
    extend: "ca.esri.core.tool.ToolbarButton",
    uses: ["ca.esri.core.tool.legend.locale." + dojo.locale, "ca.esri.core.tool.legend.Window"],
    iconCls: "icon-legend",
    textKey: "LegendText",
    tooltipKey: "LegendTooltip",
    winLcl: "ca.esri.core.tool.legend.locale.",
    winCls: "ca.esri.core.tool.legend.Window",
    layerInfos: [],
    mapOnLayerAddResultHandler: null,
    mapOnLayerRemoveHandler: null,
    initComponent: function () {
        this.winCfg = {
            layerInfos: this.layerInfos
        };
        this.callParent(arguments);
        this.relayEvents(app, ["mapCreated"]);
        this.on("mapCreated", this.onMapCreated, this)
    },
    onMapCreated: function (b) {
        this.mapOnLayerAddResultHandler = dojo.connect(b, "onLayerAddResult", this, function (d, c) {
            if (d.includeInLegend != false) {
                this.layerInfos.push({
                    layer: d
                })
            }
            if (this.window) {
                this.window.dijitLegend.refresh()
            }
        });
        this.mapOnLayerRemoveHandler = dojo.connect(b, "onLayerRemove", this, function (d) {
            if (d.includeInLegend != false) {
                for (var c = 0; c < this.layerInfos.length; c++) {
                    if (this.layerInfos[c].layer === d) {
                        this.layerInfos.splice(c, 1);
                        break
                    }
                }
            }
        })
    },
    destroy: function () {
        alert(this.$className + ".destroy - Is this ever happening?");
        dojo.disconnect(this.mapOnLayerAddResultHandler);
        this.mapOnLayerAddResultHandler.remove();
        this.mapOnLayerAddResultHandler = null;
        dojo.disconnect(this.mapOnLayerRemoveHandler);
        this.mapOnLayerRemoveHandler.remove();
        this.mapOnLayerRemoveHandler = null;
        this.callParent(arguments)
    }
});
Ext.define("ca.esri.core.tool.link.ToolbarButton", {
    extend: "ca.esri.core.tool.ToolbarButton",
    uses: ["ca.esri.core.tool.link.locale." + dojo.locale, "ca.esri.core.tool.link.Window"],
    iconCls: "icon-link",
    side: "right",
    textKey: "LinkText",
    tooltipKey: "LinkTooltip",
    winLcl: "ca.esri.core.tool.link.locale.",
    winCls: "ca.esri.core.tool.link.Window",
    constructor: function (b) {
        Ext.create("ca.esri.core.tool.link.locale." + dojo.locale).addStrings();
        this.tooltip = app.locale.i18n("LinkTooltip");
        this.initConfig(b);
        this.callParent([b])
    }
});
dojo.require("esri.tasks.locator");
Ext.define("ca.esri.core.tool.locator.Window", {
    extend: "Ext.window.Window",
    uses: ["ca.esri.core.tool.locator.Model"],
    id: "LocatorWindow",
    constrainHeader: true,
    shadow: false,
    collapsible: true,
    bodyPadding: 7,
    margin: 3,
    defaults: {
        style: {
            margin: "3px"
        }
    },
    // tools: [{
        // type: "help",
        // handler: function (d, e, b, c) {
            // app.openHelp(app.HELP_ROOT + "/Locator.html")
        // }
    // }],
    title: "Search",
    layout: "border",
    width: 300,
    height: 200,
    txtLocate: null,
    btnLocate: null,
    gridLocate: null,
    btnZoom: null,
    locator: null,
    locatorOnAddressToLocationsCompleteHandler: null,
    symbol: null,
    infoTemplate: null,
    graphic: null,
    initComponent: function () {
        this.callParent(arguments);
        this.title = app.locale.i18n("LocatorTitle");
        this.txtLocate = Ext.create("Ext.form.field.Text", {
            emptyText: app.locale.i18n("LocatorEmptyText"),
            flex: 1,
            minLength: 2,
            regex: /^[a-zA-Z0-9àâçéèêëîïôûùüÿñæœ\.\-\s\&\,]*$/
        });
        this.txtLocate.on("specialkey", this.specialKey, this);
        this.btnLocate = Ext.create("Ext.button.Button", {
            text: app.locale.i18n("LocatorTitle"),
            style: {
                "margin-left": "3px"
            }
        });
        this.btnLocate.on("click", this.sendLocateRequest, this);
        var d = Ext.create("Ext.container.Container", {
            layout: {
                type: "hbox",
                align: "stretch"
            },
            items: [this.txtLocate, this.btnLocate],
            region: "north"
        });
        var b = Ext.create("Ext.data.Store", {
            model: "ca.esri.core.tool.locator.Model",
            proxy: {
                type: "memory",
                reader: {
                    type: "json",
                    root: "items"
                }
            }
        });
        this.gridLocate = Ext.create("Ext.grid.Panel", {
            store: b,
            columns: [{
                dataIndex: "address",
                flex: 1,
                sortable: false
            }, {
                dataIndex: "x",
                hidden: true
            }, {
                dataIndex: "y",
                hidden: true
            }],
            height: 120,
            width: 268,
            region: "center",
            hideHeaders: true
        });
        this.gridLocate.on("select", this.enableZoomButton, this);
        this.gridLocate.getView().on("itemdblclick", this.zoomToLocation, this);
        this.btnZoom = Ext.create("Ext.button.Button", {
            text: app.locale.i18n("LocatorDisplayOnMap"),
            handler: this.zoomToLocation,
            scope: this,
            disabled: true
        });
        var c = Ext.create("Ext.container.Container", {
            layout: {
                type: "vbox"
            },
            items: [this.btnZoom],
            region: "south"
        });
        this.add(d);
        this.add(this.gridLocate);
        this.add(c);
        this.locator = new esri.tasks.Locator("http://tasks.arcgis.com/ArcGIS/rest/services/WorldLocator/GeocodeServer");
        this.locatorOnAddressToLocationsCompleteHandler = dojo.connect(this.locator, "onAddressToLocationsComplete", this, this.cbAddressToLocationsComplete);
        this.symbol = new esri.symbol.SimpleMarkerSymbol(esri.symbol.SimpleMarkerSymbol.STYLE_CIRCLE, 8, new esri.symbol.SimpleLineSymbol(esri.symbol.SimpleLineSymbol.STYLE_SOLID, dojo.Color.named.red, 2), dojo.Color.named.red);
        this.infoTemplate = new esri.InfoTemplate("Location", "${address}<br />")
    },
    sendLocateRequest: function (d, b) {
        if (this.txtLocate.getValue() != null) {
            this.txtLocate.setValue(this.txtLocate.getValue().replace(/^\s+|\s+$/g, ""));
            if (this.txtLocate.getValue().length < 2) {
                return
            }
        }
        var c = {
            address: {
                SingleLine: this.txtLocate.getValue(),
                Country: "Canada"
            },
            outFields: ["Loc_name"]
        };
        this.locator.outSpatialReference = app.map.spatialReference;
        this.locator.addressToLocations(c)
    },
    cbAddressToLocationsComplete: function (e) {
        this.gridLocate.getStore().removeAll();
        var c = [];
        for (var d = 0; d < e.length; d++) {
            var b = Ext.create("ca.esri.core.tool.locator.Model", {
                address: e[d].address,
                x: e[d].location.x,
                y: e[d].location.y
            });
            c.push(b)
        }
        this.gridLocate.getStore().add(c)
    },
    zoomToLocation: function (d, c) {
        var b = this.gridLocate.getSelectionModel().getSelection();
        if (b != null && b.length > 0) {
            if (this.graphic != null) {
                app.map.graphics.clear()
            }
            var f = new esri.geometry.Point(b[0].get("x"), b[0].get("y"), app.map.spatialReference);
            this.graphic = new esri.Graphic(f, this.symbol, {
                address: b[0].get("address")
            }, this.infoTemplate);
            app.map.graphics.add(this.graphic);
            app.map.infoWindow.setTitle(this.graphic.getTitle());
            app.map.infoWindow.setContent(this.graphic.getContent());
            var e = app.map.toScreen(f);
            app.map.infoWindow.resize(200, 100);
            app.map.infoWindow.show(e, app.map.getInfoWindowAnchor(e));
            app.map.centerAndZoom(f, app.map.getLevel())
        }
    },
    specialKey: function (c, b) {
        if (b.getKey() === b.RETURN || b.getKey() === b.ENTER) {
            this.btnLocate.fireEvent("click", this)
        }
    },
    enableZoomButton: function (d, c) {
        var b = this.gridLocate.getSelectionModel().getSelection();
        if (b === undefined || b.length === 0) {
            this.btnZoom.disable()
        } else {
            this.btnZoom.enable()
        }
    },
    destroy: function () {
        if (app.map.infoWindow.isShowing) {
            app.map.infoWindow.hide()
        }
        if (this.graphic != null) {
            app.map.graphics.clear()
        }
        dojo.disconnect(this.locatorOnAddressToLocationsCompleteHandler);
        this.locatorOnAddressToLocationsCompleteHandler.remove();
        this.locatorOnAddressToLocationsCompleteHandler = null;
        this.callParent(arguments)
    }
});
Ext.define("ca.esri.core.tool.measure.ToolbarButton", {
    extend: "ca.esri.core.tool.ToolbarButton",
    uses: ["ca.esri.core.tool.measure.locale." + dojo.locale, "ca.esri.core.tool.measure.Window"],
    iconCls: "icon-measure",
    side: "right",
    textKey: "MeasureText",
    tooltipKey: "MeasureTooltip",
    winLcl: "ca.esri.core.tool.measure.locale.",
    winCls: "ca.esri.core.tool.measure.Window"
});
Ext.define("ca.esri.core.tool.printmap.ToolbarButton", {
    extend: "ca.esri.core.tool.ToolbarButton",
    uses: ["ca.esri.core.tool.printmap.locale." + dojo.locale, "ca.esri.core.tool.printmap.Window"],
    iconCls: "icon-printmap",
    side: "right",
    textKey: "PrintMapText",
    tooltipKey: "PrintMapTooltip",
    winLcl: "ca.esri.core.tool.printmap.locale.",
    winCls: "ca.esri.core.tool.printmap.Window",
    destroy: function () {
        alert(this.$className + ".destroy - Is this ever happening?");
        this.callParent(arguments)
    }
});
Ext.define("ca.esri.core.tool.zoomfull.ToolbarButton", {
    extend: "ca.esri.core.tool.ToolbarButton",
    uses: ["ca.esri.core.tool.zoomfull.locale." + dojo.locale],
    iconCls: "icon-zoomfull",
    tooltipKey: "Zoom2InitialExtentsTooltip",
    winLcl: "ca.esri.core.tool.zoomfull.locale.",
    handler: function (c, b) {
        app.map.setExtent(app.initExtent)
    }
});
Ext.define("ca.esri.core.tool.addlayer.ToolbarButton", {
    extend: "ca.esri.core.tool.ToolbarButton",
    uses: ["ca.esri.core.tool.addlayer.locale." + dojo.locale, "ca.esri.core.tool.addlayer.Window"],
    iconCls: "icon-addlayer",
    textKey: "AddLayerText",
    tooltipKey: "AddLayerTooltip",
    winLcl: "ca.esri.core.tool.addlayer.locale.",
    winCls: "ca.esri.core.tool.addlayer.Window"
});
dojo.require("esri.tasks.GenerateRendererTask");
dojo.require("esri.dijit.Legend");
Ext.define("ca.esri.core.tool.dynamicrenderer.Window", {
    extend: "Ext.window.Window",
    uses: ["ca.esri.core.esristore.mapservice.Layers", "ca.esri.core.esristore.mapservicelayer.Fields", "ca.esri.core.tool.dynamicrenderer.ClassificationMethodModel", "Ext.ux.ColorField"],
    id: "DynamicRendererWindow",
    constrainHeader: true,
    shadow: false,
    collapsible: true,
    bodyPadding: 7,
    margin: 3,
    defaults: {
        style: {
            margin: "3px"
        }
    },
    // tools: [{
        // type: "help",
        // handler: function (d, e, b, c) {
            // app.openHelp(app.HELP_ROOT + "/DynamicRenderer.html")
        // }
    // }],
    layout: "anchor",
    width: 300,
    cmbLayers: null,
    cmbFields: null,
    cmbClassMethod: null,
    cmbClassBreaks: null,
    cmbRampFrom: null,
    cmbRampTo: null,
    fieldSetRamp: null,
    btnRender: null,
    urlAppendix: "?f=pjson",
    service: null,
    layerId: null,
    dynamicLayerInfos: null,
    initComponent: function () {
        this.callParent(arguments);
        this.title = app.locale.i18n("DRTitle");
        if (this.service === undefined) {
            alert(this.$className + ".constructor requires the dynamic layer be passed in the config.");
            return
        }
        if (this.service._map === null) {
            alert(app.locale.i18n("DRCannotConnect"));
            return
        }
        var b = Ext.create("ca.esri.core.esristore.mapservice.Layers", {
            url: this.service.url + this.urlAppendix
        });
        this.cmbLayers = Ext.create("Ext.form.field.ComboBox", {
            hideLabel: true,
            displayField: "name",
            emptyText: app.locale.i18n("DRSelectLayer"),
            store: b,
            serviceUrl: this.service.url,
            forceSelection: true,
            editable: false,
            anchor: "100%"
        });
        this.cmbLayers.on("select", this.layersComboBox_Select, this);
        this.cmbLayers.on("removed", this.layersComboBox_Removed, this);
        this.add(this.cmbLayers)
    },
    layersComboBox_Removed: function (b, c, d) {
        if (this.cmbFields != null) {
            this.remove(this.cmbFields);
            this.cmbFields = null
        }
    },
    layersComboBox_Select: function (d, c, e) {
        if (this.cmbFields != null) {
            this.remove(this.cmbFields);
            this.cmbFields = null
        }
        var b = Ext.create("ca.esri.core.esristore.mapservicelayer.Fields", {
            url: d.serviceUrl + "/" + c[0].get("id") + this.urlAppendix
        });
        this.cmbFields = Ext.create("Ext.form.field.ComboBox", {
            hideLabel: true,
            displayField: "alias",
            emptyText: app.locale.i18n("DRSelectField"),
            store: b,
            serviceUrl: d.serviceUrl,
            layerId: c[0].get("id"),
            editable: false,
            forceSelection: true,
            anchor: "100%"
        });
        this.cmbFields.on("select", this.fieldsComboBox_Select, this);
        this.cmbFields.on("removed", this.fieldsComboBox_Removed, this);
        this.add(this.cmbFields)
    },
    fieldsComboBox_Select: function (c, b, d) {
        this.fieldsComboBox_Removed(c, c.ownerCt, d);
        this.layerId = c.layerId;
        var e = null;
        switch (b[0].get("type")) {
        case "esriFieldTypeString":
            this.initColorRampFieldSet();
            e = this.uniqueValueRender;
            break;
        case "esriFieldTypeSingle":
        case "esriFieldTypeDouble":
            this.initComponents4ClassBreaks(c, b, d);
            e = this.classBreaksRender;
            break;
        case "esriFieldTypeSmallInteger":
        case "esriFieldTypeInteger":
            this.initComponents4ClassBreaks(c, b, d);
            e = this.classBreaksRender;
            break
        }
        if (e === null) {
            alert("can't symbolize that field");
            return
        }
        this.btnRender = Ext.create("Ext.Button", {
            text: app.locale.i18n("DRRenderMap"),
            handler: e,
            scope: this,
            serviceUrl: c.serviceUrl,
            fieldDef: b[0]
        });
        switch (b[0].get("type")) {
        case "esriFieldTypeString":
            this.add([this.fieldSetRamp, this.btnRender]);
            break;
        case "esriFieldTypeSingle":
        case "esriFieldTypeDouble":
            this.add([this.cmbClassMethod, this.cmbClassBreaks, this.fieldSetRamp, this.btnRender]);
            break;
        case "esriFieldTypeSmallInteger":
        case "esriFieldTypeInteger":
            this.add([this.cmbClassMethod, this.cmbClassBreaks, this.fieldSetRamp, this.btnRender]);
            break
        }
    },
    initComponents4ClassBreaks: function (d, c, e) {
        var b = Ext.create("Ext.data.Store", {
            model: "ca.esri.core.tool.dynamicrenderer.ClassificationMethodModel",
            data: [{
                type: "equal-interval",
                name: app.locale.i18n("DRClassMethodEqInt")
            }, {
                type: "natural-breaks",
                name: app.locale.i18n("DRClassMethodNatBrks")
            }, {
                type: "quantile",
                name: app.locale.i18n("DRClassMethodQuantile")
            }]
        });
        this.cmbClassMethod = Ext.create("Ext.form.field.ComboBox", {
            emptyText: app.locale.i18n("DRSelectClassMethod"),
            anchor: "100%",
            store: b,
            displayField: "name",
            valueField: "type",
            value: "natural-breaks",
            forceSelection: true,
            queryMode: "local",
            serviceUrl: d.serviceUrl
        });
        this.cmbClassMethod.on("select", this.clearLayerDisplay, this);
        this.cmbClassBreaks = Ext.create("Ext.form.field.ComboBox", {
            emptyText: app.locale.i18n("DRSelectClassBreaks"),
            anchor: "100%",
            store: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
            value: 5,
            forceSelection: true,
            serviceUrl: d.serviceUrl
        });
        this.cmbClassBreaks.on("select", this.clearLayerDisplay, this);
        this.initColorRampFieldSet()
    },
    initColorRampFieldSet: function () {
        this.cmbRampFrom = Ext.create("Ext.ux.ColorField", {
            fieldLabel: app.locale.i18n("DRFrom"),
            width: "100%"
        });
        this.cmbRampFrom.on("change", this.onChangeColor, this);
        this.cmbRampFrom.setValue("CCFFCC");
        this.cmbRampTo = Ext.create("Ext.ux.ColorField", {
            fieldLabel: app.locale.i18n("DRTo"),
            width: "100%"
        });
        this.cmbRampTo.on("change", this.onChangeColor, this);
        this.cmbRampTo.setValue("006837");
        this.fieldSetRamp = Ext.create("Ext.form.FieldSet", {
            title: app.locale.i18n("DRColourRamp"),
            layout: "column",
            items: [this.cmbRampFrom, this.cmbRampTo],
            style: {
                margin: "3px",
                padding: "3px"
            }
        })
    },
    clearLayerDisplay: function (c, b, d) {
        this.service.setVisibleLayers([-1])
    },
    onChangeColor: function (c, d, b) {
        this.clearLayerDisplay()
    },
    fieldsComboBox_Removed: function (b, c, d) {
        this.clearLayerDisplay();
        if (this.cmbClassMethod != null) {
            this.remove(this.cmbClassMethod);
            this.cmbClassMethod = null
        }
        if (this.cmbClassBreaks != null) {
            this.remove(this.cmbClassBreaks);
            this.cmbClassBreaks = null
        }
        if (this.cmbRampFrom != null) {
            this.remove(this.cmbRampFrom);
            this.cmbRampFrom = null
        }
        if (this.cmbRampTo != null) {
            this.remove(this.cmbRampTo);
            this.cmbRampTo = null
        }
        if (this.fieldSetRamp != null) {
            this.remove(this.fieldSetRamp);
            this.fieldSetRamp = null
        }
        if (this.btnRender != null) {
            this.remove(this.btnRender);
            this.btnRender = null
        }
    },
    uniqueValueRender: function (c, b) {
        if (c.classDef != null) {}
        c.classDef = new esri.tasks.UniqueValueDefinition();
        c.classDef.attributeField = c.fieldDef.get("name");
        c.classDef.baseSymbol = new esri.symbol.SimpleFillSymbol("solid", null, null);
        var f = new esri.tasks.AlgorithmicColorRamp();
        f.fromColor = new dojo.colorFromHex("#" + this.cmbRampFrom.getValue());
        f.toColor = new dojo.colorFromHex("#" + this.cmbRampTo.getValue());
        f.algorithm = "hsv";
        c.classDef.colorRamp = f;
        var e = new esri.tasks.GenerateRendererParameters();
        e.classificationDefinition = c.classDef;
        var d = new esri.tasks.GenerateRendererTask(c.serviceUrl + "/" + this.layerId);
        d.execute(e, dojo.hitch(this, this.cbExecuteGenerateRendererTask), this.errorHandler)
    },
    classBreaksRender: function (c, b) {
        if (c.classDef != null) {}
        c.classDef = new esri.tasks.ClassBreaksDefinition();
        c.classDef.classificationField = c.fieldDef.get("name");
        c.classDef.classificationMethod = this.cmbClassMethod.getValue();
        c.classDef.breakCount = this.cmbClassBreaks.getValue();
        c.classDef.baseSymbol = new esri.symbol.SimpleFillSymbol("solid", null, null);
        var f = new esri.tasks.AlgorithmicColorRamp();
        f.fromColor = new dojo.colorFromHex("#" + this.cmbRampFrom.getValue());
        f.toColor = new dojo.colorFromHex("#" + this.cmbRampTo.getValue());
        f.algorithm = "hsv";
        c.classDef.colorRamp = f;
        var e = new esri.tasks.GenerateRendererParameters();
        e.classificationDefinition = c.classDef;
        var d = new esri.tasks.GenerateRendererTask(c.serviceUrl + "/" + this.layerId);
        d.execute(e, dojo.hitch(this, this.cbExecuteGenerateRendererTask), this.errorHandler)
    },
    cbExecuteGenerateRendererTask: function (d) {
        var c = [];
        var b = new esri.layers.LayerDrawingOptions();
        b.renderer = d;
        c[this.layerId] = b;
        this.service.setLayerDrawingOptions(c);
        this.service.setVisibleLayers([this.layerId])
    },
    destroy: function () {
        ca.esri.core.tool.dynamicrenderer.Window.superclass.destroy.apply(this, arguments)
    },
    errorHandler: function (b) {
        alert(app.locale.i18n("ErrorMsg") + this.$className + " - " + b.message)
    }
});
Ext.define("ca.esri.core.tool.layerlist.ServicesPanel", {
    extend: "Ext.panel.Panel",
    uses: ["ca.esri.core.tool.layerlist.ContextMenu"],
    layout: "border",
    height: 250,
    id: "ServicesPanel",
    border: false,
    parentTreeStore: null,
    panel: null,
    mapOnExtentChangeHandler: null,
    mapOnLayerAddResultHandler: null,
    mapOnLayerRemoveHandler: null,
    getTitle: function () {
        return ""
    },
    initComponent: function () {
        this.callParent();
        this.add({
            xtype: "label",
            text: this.getTitle(),
            region: "north"
        });
        this.parentTreeStore = Ext.create("Ext.data.TreeStore", {
            root: {}
        });
        this.panel = Ext.create("Ext.tree.Panel", {
            store: this.parentTreeStore,
            region: "center",
            rootVisible: false,
            hideHeaders: true,
            viewConfig: {
                emptyText: app.locale.i18n("LayerListNoLayers"),
                deferEmptyText: false
            },
            columns: [{
                xtype: "treecolumn",
                flex: 1,
                dataIndex: "text"
            }, {
                xtype: "actioncolumn",
                flex: 0,
                width: "10%",
                items: [{
                    width: "15%",
                    scope: this,
                    getClass: function (e, d, f, g, c, b) {
                        if (f.raw.service || f.raw.hasMetadata) {
                            return "action_arrow"
                        }
                        return "x-hide-display"
                    },
                    handler: this.openContextMenu
                }]
            }]
        });
        this.panel.on("checkchange", this.treeOnCheckChange, this);
        this.panel.on("afterrender", this.onAfterRenderPanel, this);
        this.add(this.panel);
        this.on("afterrender", this.onAfterRender)
    },
    openContextMenu: function (g, f, h, k, j) {
        var d = g.getStore().getAt(f);
        var c = g.getNode(d);
        var b = Ext.create("ca.esri.core.tool.layerlist.ContextMenu", {
            view: g,
            rec: d,
            node: c,
            index: f,
            event: j,
            callingPanel: this
        });
        var e = Ext.getDom(c).getBoundingClientRect();
        b.showAt([e.right, e.top]);
        j.stopEvent()
    },
    addTree: function (h) {
        var d = this.parentTreeStore.getRootNode();
        if (d.hasChildNodes()) {
            var g = false;
            var f = Ext.Array.indexOf(this.getIdsArray(), h.raw.service.id);
            var k = d.childNodes;
            for (var c = 0; c < k.length; c++) {
                if (f > Ext.Array.indexOf(this.getIdsArray(), k[c].raw.service.id)) {
                    var b = d.insertBefore(h.raw, k[c]);
                    g = true;
                    if (h.hasChildNodes()) {
                        var m = h.childNodes;
                        for (var j = 0, e = m.length; j < e; j++) {
                            this.appendNode(b, m[j])
                        }
                    }
                    break
                }
            }
            if (!g) {
                this.appendNode(d, h)
            }
        } else {
            this.appendNode(d, h)
        }
    },
    appendNode: function (d, g) {
        if (d && g) {
            var e = d.appendChild(g.raw);
            if (g.hasChildNodes()) {
                var f = g.childNodes;
                for (var c = 0, b = f.length; c < b; c++) {
                    this.appendNode(e, f[c])
                }
            }
        }
    },
    treeOnItemClick: function (d, c, g, e, b, f) {
        if (b && b.browserEvent && b.browserEvent.cancelBubble) {
            return
        }
        c.set("checked", !c.get("checked"));
        c.commit();
        this.treeOnCheckChange(c, c.get("checked"), {
            event: b
        })
    },
    treeOnCheckChange: function (d, m, h) {
        if (h && h.event && h.event.ctrlKey === true) {
            var n = d.parentNode;
            var c;
            for (var f = 0; f < n.childNodes.length; f++) {
                n.childNodes[f].set("checked", m);
                n.childNodes[f].commit();
                this.treeOnCheckChange(n.childNodes[f], m)
            }
        }
        if (d.raw.service) {
            d.raw.service.setVisibility(m);
            return
        }
        var g = this.getService(d);
        var e = d.parentNode;
        while (!e.parentNode.isRoot()) {
            if (e.get("checked") === false) {
                return
            }
            e = e.parentNode
        }
        var j = this.getVisibleLayersFromTree(d);
        if (m) {
            j.push.apply(j, g.visibleLayers)
        } else {
            j.push(d.raw.id);
            var b = [];
            for (var f = 0; f < g.visibleLayers.length; ++f) {
                if (Ext.Array.indexOf(j, g.visibleLayers[f]) === -1) {
                    b.push(g.visibleLayers[f])
                }
            }
            j = b
        }
        var k = Ext.Array.indexOf(j, -1);
        if (k != -1) {
            j.splice(k, 1)
        }
        if (j.length === 0) {
            if (g instanceof esri.layers.ArcGISDynamicMapServiceLayer || g instanceof esri.layers.ArcGISTiledMapServiceLayer) {
                j.push(-1)
            }
        }
        g.setVisibleLayers(j);
        this.updatePopupFeatureLayerVisibility(g)
    },
    updatePopupFeatureLayerVisibility: function (c) {
        var d = null;
        if (c.popupFeatureLayers != null) {
            var b = -1;
            for (var e in c.popupFeatureLayers) {
                b = parseInt(e);
                if (Ext.Array.indexOf(c.visibleLayers, b) > -1) {
                    c.popupFeatureLayers[b].setVisibility(true)
                } else {
                    c.popupFeatureLayers[b].setVisibility(false)
                }
            }
        }
    },
    getService: function (c) {
        var b = c.parentNode;
        while (!b.isRoot()) {
            c = b;
            b = c.parentNode
        }
        return c.raw.service
    },
    getVisibleLayersFromTree: function (d) {
        var c = [];
        if (d.isLeaf()) {
            if (d.get("checked")) {
                c.push(d.raw.id)
            }
        } else {
            for (var b = 0; b < d.childNodes.length; b++) {
                var e = this.getVisibleLayersFromTree(d.childNodes[b]);
                if (e.length > 0) {
                    c.push.apply(c, e)
                }
            }
        }
        return c
    },
    addService: function (b) {
        if (b._map === null) {
            return false
        }
        return true
    },
    removeService: function (b) {
        var d = this.parentTreeStore.getRootNode().childNodes;
        for (var c = 0; c < d.length; c++) {
            if (d[c].raw.service === b) {
                this.parentTreeStore.getRootNode().removeChild(d[c])
            }
        }
    },
    treeOnItemContextMenu: function (c, f, e, d, b) {
        b.stopEvent()
    },
    onAfterRenderPanel: function (c, b) {
        var e = Ext.getDom(this.id).getElementsByTagName("tr");
        for (var d = 0; d < e.length; d++) {
            if (e[d].className.indexOf("x-grid-row") > -1) {
                e[d].setAttribute("tabindex", "0");
                e[d].setAttribute("onfocus", "Ext.getDom('" + this.id + "').style.border='1px dotted';");
                e[d].setAttribute("onblur", "Ext.getDom('" + this.id + "').style.border='none';");
                break
            }
        }
        var f = new Ext.util.KeyMap({
            target: c.getView(),
            eventName: "itemkeydown",
            processEvent: function (h, g, m, j, k) {
                k.view = h;
                k.store = h.getStore();
                k.record = g;
                k.index = j;
                return k
            },
            binding: {
                key: 190,
                shift: true,
                ctrl: false,
                alt: false,
                scope: this,
                fn: function (h, g) {
                    this.openContextMenu(g.view, g.view.getSelectionModel().getLastFocused().get("index"), null, null, g)
                }
            }
        })
    },
    onAfterRender: function (c, b) {
        this.mapOnExtentChangeHandler = dojo.connect(app.map, "onExtentChange", this, function (d, h, g, e) {
            var f = this.getCls;
            this.panel.getStore().getRootNode().cascadeBy(function (k) {
                var j = f(k.raw);
                k.set("cls", j)
            })
        });
        this.mapOnLayerAddResultHandler = dojo.connect(app.map, "onLayerAddResult", this, this.addService);
        this.mapOnLayerRemoveHandler = dojo.connect(app.map, "onLayerRemove", this, this.removeService);
        this.un("afterrender", this.onAfterRender)
    },
    getCls: function (c) {
        var b = "enabled-node";
        if (c.minScale != 0 && c.minScale < app.map.getScale()) {
            b = "disabled-node"
        }
        if (c.maxScale != 0 && c.maxScale > app.map.getScale()) {
            b = "disabled-node"
        }
        return b
    },
    createTreeStore: function (b) {
        Ext.create("Ext.data.TreeStore", {
            root: b,
            listeners: {
                scope: this,
                rootchange: function (c, d) {
                    this.addTree(c)
                }
            }
        })
    },
    destroy: function () {
        dojo.disconnect(this.mapOnExtentChangeHandler);
        this.mapOnExtentChangeHandler.remove();
        this.mapOnExtentChangeHandler = null;
        dojo.disconnect(this.mapOnLayerAddResultHandler);
        this.mapOnLayerAddResultHandler.remove();
        this.mapOnLayerAddResultHandler = null;
        dojo.disconnect(this.mapOnLayerRemoveHandler);
        this.mapOnLayerRemoveHandler.remove();
        this.mapOnLayerRemoveHandler = null;
        this.callParent(arguments)
    }
});
Ext.define("ca.esri.core.tool.locator.ToolbarButton", {
    extend: "ca.esri.core.tool.ToolbarButton",
    uses: ["ca.esri.core.tool.locator.locale." + dojo.locale, "ca.esri.core.tool.locator.Window"],
    iconCls: "icon-search",
    tooltipKey: "LocatorTooltip",
    winLcl: "ca.esri.core.tool.locator.locale.",
    winCls: "ca.esri.core.tool.locator.Window"
});
dojo.require("esri.map");
dojo.require("esri.dijit.Scalebar");
dojo.require("esri.dijit.OverviewMap");
Ext.define("ca.esri.core.Application", {
    extend: "Ext.app.Application",
    name: "ca.esri.core.Application",
    uses: ["ca.esri.core.locale." + dojo.locale, "ca.esri.core.tool.locator.ToolbarButton", "ca.esri.core.tool.bookmarks.ToolbarButton", "ca.esri.core.tool.about.ToolbarButton", "ca.esri.core.tool.zoomfull.ToolbarButton", "Ext.override.data.TreeStore", "Ext.override.form.field.Base", "Ext.override.form.field.Text", "Ext.override.panel.Tool", "Ext.override.tree.Column", "Ext.override.window.Window", "ca.esri.core.tool.printmap.ToolbarButton", "ca.esri.core.tool.changebasemap.ToolbarButton", "ca.esri.core.MetadataTranslator", "ca.esri.core.MapClickManager", "ca.esri.core.Geocoder", "ca.esri.core.util.Format"],
    map: null,
    toolbar: null,
    pnlMap: null,
    geocoder: null,
    initExtent: null,
    mapClickManager: null,
    mapOnLoadHandler: null,
    mapOnUpdateStartHandler: null,
    mapOnUpdateEndHandler: null,
    loadingMask: null,
    keyMap4MouseEvts: null,
    basemap1: null,
    basemap2: null,
    AGS_DOMAIN: null,
    AGS_RESTSERVICES: null,
    WL_DOMAIN: null,
    PRT_DOMAIN: null,
    CLIENT_ROOT: null,
    WS_OUTPUT: null,
    APP_ROOT: null,
    HELP_ROOT: null,
    PROXY_FILE: null,
    constructor: function (c) {
        this.initConfig(c);
        var b = "";
        if (window.location.port.length > 0) {
            b = ":" + window.location.port
        }
        this.CLIENT_ROOT = this.WL_DOMAIN = this.AGS_DOMAIN = this.WS_OUTPUT = this.PRT_DOMAIN = [window.location.protocol, "//", window.location.hostname, b, "/", (dojo.locale === "en") ? "wcag" : "wcag"].join("");
        this.HELP_ROOT = [this.CLIENT_ROOT, "/help/", (dojo.locale === "en") ? "eng" : "fra", "/?id="].join("");
        this.CLIENT_ROOT = [this.CLIENT_ROOT, "/EMAF/"].join("");
        this.AGS_DOMAIN = [this.AGS_DOMAIN, "/ags_domain/"].join("");
        this.WL_DOMAIN = [this.WL_DOMAIN, "/wl_domain/"].join("");
        this.PRT_DOMAIN = [this.PRT_DOMAIN, "/prt_domain/"].join("");
        this.WS_OUTPUT = [this.WS_OUTPUT, "/EMAF_OUT/"].join("");
        this.AGS_RESTSERVICES = [this.AGS_DOMAIN, "rest/services/"].join("");
        this.APP_ROOT = [this.CLIENT_ROOT, "apps/", dojo.locale].join("");
        this.PROXY_FILE = [this.CLIENT_ROOT, "proxy/proxy.ashx"].join("");
        this.params = this.getParameters();
        Ext.Ajax.request({
            url: [this.CLIENT_ROOT, "?app=", this.$className, "&lang=", dojo.locale].join(""),
            method: "HEAD"
        });
        this.callParent([c]);
        this.addEvents({
            mapCreated: true,
            appLoaded: true
        });
        this.on("mapCreated", this.onMapCreated, this);
        this.on("appLoaded", this.onAppLoaded, this)
    },
    onAppLoaded: function (b) {},
    onMapCreated: function (b) {},
    launch: function () {
        var b = document.body.className.replace("x-body", "");
        document.body.className = b;
        if (this.flowLayout != false) {
            var c = [".width {", "  width:220px!important;", "}", "#wb-body-sec #wb-main, #wb-body-sec-sup #wb-main, #wb-body-sec #wb-main-in, #wb-body-sec-sup #wb-main-in, #wb-body #gcwu-content, #wb-core-in, #gcwu-gcnb-in, #gcwu-bnr-in, #gcwu-psnb-in, #gcwu-bc-in, #gcwu-gcft-in, #gcwu-sft-in, #gcwu-psnb .mb-menu, #wb-body #wb-main {", "  width: 100%;", "}"].join("");
            Ext.util.CSS.createStyleSheet(c, "flowLayoutCss")
        }
        this.callParent();
        this.locale = Ext.create("ca.esri.core.locale." + dojo.locale);
        Ext.form.field.Base.prototype.labelSeparator = this.locale.i18n("labelSeparator");
        this.initExtJsContainer();
        dojo.ready(this, this.initEsriObjects)
    },
    initExtJsContainer: function () {
        this.toolbar = Ext.create("Ext.toolbar.Toolbar", {
            id: "Core_Toolbar",
            width: "100%",
            border: false,
            region: "north",
            enableOverflow: true
        });
        this.pnlMap = Ext.create("Ext.panel.Panel", {
            id: "Core_Map",
            width: "100%",
            height: "100%",
            border: false,
            region: "center"
        });
        var b = Ext.create("Ext.container.Container", {
            id: "Core_Container",
            renderTo: "extjsApp",
            layout: "border",
            height: this.getAppDivHeight(),
            margin: 10,
            defaults: {
                border: false
            },
            items: [this.toolbar, this.pnlMap],
            style: {
                background: "transparent"
            }
        });
        b.center()
    },
    initEsriObjects: function () {
        esri.config.defaults.io.proxyUrl = this.PROXY_FILE;
        this.initMap()
    },
    initMap: function () {
        this.addTools2Toolbar();
        if (!Ext.isIE) {
            Ext.getDoc().on("DOMNodeInserted", this.setTabIndexOnSlider)
        }
        if (this.map === null) {
            this.map = new esri.Map(this.pnlMap.getContentTarget().id, {
                wrapAround180: true,
                logo: false,
                extent: this.initExtent,
                sliderStyle: "large",
                showAttribution: false
            });
            if (this.basemap1 === null) {
                this.basemap1 = new esri.layers.ArcGISTiledMapServiceLayer("http://server.arcgisonline.com/ArcGIS/rest/services/World_Terrain_Base/MapServer");
                this.basemap1.includeInLegend = false;
                this.basemap1.basemapGalleryLayerType = "basemap";
                this.basemap2 = new esri.layers.ArcGISTiledMapServiceLayer("http://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Reference_Overlay/MapServer");
                this.basemap2.includeInLegend = false;
                this.basemap2.basemapGalleryLayerType = "reference"
            }
        }
        this.fireEvent("mapCreated", this.map);
        this.mapClickManager = Ext.create("ca.esri.core.MapClickManager", {
            map: this.map
        });
        if (this.map.loaded) {
            this.enhanceMap();
            this.addAlt2MapTiles()
        } else {
            this.mapOnLoadHandler = dojo.connect(this.map, "onLoad", this, this.enhanceMap)
        }
    },
    enhanceMap: function () {
        new esri.dijit.Scalebar({
            map: this.map,
            scalebarUnit: "metric"
        });
        var e = this.map.graphics._div.parent.rawNode;
        e.setAttribute("focusable", "false");
        e = Ext.getDom(this.map.id);
        e.setAttribute("tabindex", "0");
        var e = this.map.root.firstChild;
        while (e != null) {
            if (e.id != null && e.id.indexOf("zoom_slider") > -1) {
                break
            }
            e = e.nextSibling
        }
        if (e != null) {
            var d = e.getElementsByTagName("div");
            for (var c = 0, b = d.length; c < b; c++) {
                if (d[c].className.indexOf("dijitSliderImageHandle") > -1) {
                    d[c].setAttribute("tabindex", "-1")
                }
            }
        }
        this.geocoder = Ext.create("ca.esri.core.Geocoder").show();
        this.addOverviewMap();
        this.applyParams();
        this.addBrowserEvtListeners();
        this.addKeyEvtListeners();
        this.addMapEvtListeners();
        this.fireEvent("appLoaded", app)
    },
    setTabIndexOnSlider: function (e) {
        if (e && e.target && e.target.id) {
            if (e.target.id.indexOf("zoom_slider") > -1 && e.target.nodeName === "TABLE") {
                var d = e.target.getElementsByTagName("div");
                for (var c = 0, b = d.length; c < b; c++) {
                    if (d[c].className.indexOf("dijitSliderImageHandle") > -1) {
                        d[c].setAttribute("tabindex", "-1")
                    }
                }
                Ext.getDoc().un("DOMNodeInserted", this.setTabIndexOnSlider)
            }
        }
    },
    addOverviewMap: function () {
        var f = new esri.dijit.OverviewMap({
            map: this.map,
            attachTo: "bottom-right",
            opacity: 0.2,
            expandFactor: 10
        });
        f.startup();
        var c = null;
        var e = 0;
        var b = Ext.getDom("esri_dijit_OverviewMap_" + e);
        while (b != null) {
            c = b.getElementsByTagName("div");
            for (var d = 0; d < c.length; d++) {
                className = c[d].className;
                if (className && className.indexOf("ovwButton") != -1) {
                    c[d].tabIndex = 0;
                    c[d].id = b.id + "_ovwButton_" + d;
                    new Ext.util.KeyMap(c[d].id, {
                        key: Ext.EventObject.ENTER,
                        fn: function (h, g) {
                            if (f.visible) {
                                f.hide()
                            } else {
                                f.show()
                            }
                        }
                    })
                }
            }
            b = Ext.getDom("esri_dijit_OverviewMap_" + ++e)
        }
    },
    applyParams: function () {
        if (this.params.X != null && this.params.Y != null && this.params.LEVEL != null) {
            try {
                var b = parseFloat(this.params.X);
                var f = parseFloat(this.params.Y);
                var e = parseInt(this.params.LEVEL);
                var d = new esri.geometry.Point(b, f, this.map.spatialReference);
                this.map.centerAndZoom(d, e)
            } catch (c) {}
        }
    },
    addBrowserEvtListeners: function () {
        dojo.connect(window, "resize", this, function (b) {
            var c = this.getAppDivHeight();
            Ext.getCmp("Core_Container").setHeight(c);
            Ext.getCmp("Core_Container").doLayout();
            this.map.resize();
            this.toolbar.doLayout()
        })
    },
    showLoadingMask: function (b) {
        if (this.loadingMask === null) {
            if (Ext.versions.extjs.minor === 1) {
                this.loadingMask = new Ext.LoadMask(Ext.getDom("Core_Map"))
            } else {
                this.loadingMask = new Ext.LoadMask({
                    target: Ext.getDom("Core_Map")
                })
            }
        }
        this.loadingMask.msg = b || app.locale.i18n("LoadMaskText");
        this.loadingMask.show()
    },
    hideLoadingMask: function () {
        if (this.loadingMask != null) {
            this.loadingMask.hide()
        }
    },
    closeLoadingMask: function () {
        if (this.loadingMask) {
            this.loadingMask.hide();
            this.loadingMask.destroy();
            this.loadingMask = null
        }
    },
    addMapEvtListeners: function () {
        this.mapOnUpdateStartHandler = dojo.connect(this.map, "onUpdateStart", this, function () {
            this.showLoadingMask()
        });
        this.mapOnUpdateEndHandler = dojo.connect(this.map, "onUpdateEnd", this, function () {
            this.hideLoadingMask();
            this.addAlt2MapTiles()
        })
    },
    addAlt2MapTiles: function () {
        var c = Ext.getDom("Core_Map");
        var d = c.getElementsByTagName("img");
        for (var b = 0; b < d.length; b++) {
            d[b].alt = d[b].id
        }
    },
    addKeyEvtListeners: function () {
        this.keyMap4MouseEvts = new Ext.util.KeyMap({
            target: document,
            binding: [{
                key: [187, 61],
                shift: true,
                ctrl: false,
                alt: false,
                scope: this.map,
                fn: function (d, c) {
                    this.setLevel(this.getLevel() + 1);
                    c.stopEvent()
                }
            }, {
                key: [189, 173],
                shift: false,
                ctrl: false,
                alt: false,
                scope: this.map,
                fn: function (d, c) {
                    this.setLevel(this.getLevel() - 1);
                    c.stopEvent()
                }
            }]
        });
        this.keyMap4MouseEvts.disable();
        this.pnlMap.body.on("mouseenter", function (c, e, d) {
            if (app.allowKeyMap4MouseEvts != false) {
                this.keyMap4MouseEvts.enable()
            }
        }, this);
        this.pnlMap.body.on("mouseleave", function (c, e, d) {
            this.keyMap4MouseEvts.disable()
        }, this);
        var b = new Ext.util.KeyMap({
            target: this.map.id,
            binding: [{
                key: [187, 61],
                shift: true,
                ctrl: false,
                alt: false,
                scope: this.map,
                fn: function (d, c) {
                    this.setLevel(this.getLevel() + 1);
                    c.stopEvent()
                }
            }, {
                key: [107, 43],
                shift: false,
                ctrl: false,
                alt: false,
                scope: this.map,
                fn: function (d, c) {
                    this.setLevel(this.getLevel() + 1);
                    c.stopEvent()
                }
            }, {
                key: [189, 173, 109, 45],
                shift: false,
                ctrl: false,
                alt: false,
                scope: this.map,
                fn: function (d, c) {
                    this.setLevel(this.getLevel() - 1);
                    c.stopEvent()
                }
            }, {
                key: [98, 40],
                shift: false,
                ctrl: false,
                alt: false,
                scope: this.map,
                fn: function (d, c) {
                    this._fixedPan(0, this.height * 0.0135);
                    c.stopEvent()
                }
            }, {
                key: [100, 37],
                shift: false,
                ctrl: false,
                alt: false,
                scope: this.map,
                fn: function (d, c) {
                    this._fixedPan(this.width * -0.0135, 0);
                    c.stopEvent()
                }
            }, {
                key: [102, 39],
                shift: false,
                ctrl: false,
                alt: false,
                scope: this.map,
                fn: function (d, c) {
                    this._fixedPan(this.width * 0.0135, 0);
                    c.stopEvent()
                }
            }, {
                key: [104, 38],
                shift: false,
                ctrl: false,
                alt: false,
                scope: this.map,
                fn: function (d, c) {
                    this._fixedPan(0, this.height * -0.0135);
                    c.stopEvent()
                }
            }]
        })
    },
    scrollPage: function (b, d, c) {
        if (b === "yes") {
            var f = document.getElementById("wb-cont");
            var g = {
                x: 0,
                y: 0
            };
            while (f) {
                g.x += f.offsetLeft;
                g.y += f.offsetTop;
                f = f.offsetParent
            }
            if (document.documentElement && (document.documentElement.scrollTop || document.documentElement.scrollLeft)) {
                g.x -= document.documentElement.scrollLeft;
                g.y -= document.documentElement.scrollTop
            } else {
                if (document.body && (document.body.scrollTop || document.body.scrollLeft)) {
                    g.x -= document.body.scrollLeft;
                    g.y -= document.body.scrollTop
                } else {
                    if (window.pageXOffset || window.pageYOffset) {
                        g.x -= window.pageXOffset;
                        g.y -= window.pageYOffset
                    }
                }
            }
            window.scrollTo(0, g.y)
        }
    },
    addTools2Toolbar: function () {
        var e = this.addTools();
        var d = [];
        var b = [];
        for (var c = 0; c < e.length; c++) {
            if (e[c].side === "right") {
                d.push(e[c])
            } else {
                b.push(e[c])
            }
        }
        if (b.length > 1) {
            b.push({
                xtype: "tbfill"
            })
        }
        d.reverse();
        for (var c = 0; c < d.length; c++) {
            b.push(d[c])
        }
        if (b.length > 1) {
            this.toolbar.add(b)
        }
    },
    addTools: function (b) {
        b = b || {};
        var d = [];
        if (b.legend != false) {
            d.push(Ext.create("ca.esri.core.tool.legend.ToolbarButton"))
        }
        // if (b.addlayer != false) {
            // d.push(Ext.create("ca.esri.core.tool.addlayer.ToolbarButton"))
        // }
        if (b.layerlist != false) {
            d.push(Ext.create("ca.esri.core.tool.layerlist.ToolbarButton"))
        }
        if (b.changebasemap != false) {
            d.push(Ext.create("ca.esri.core.tool.changebasemap.ToolbarButton"))
        }
        // if (b.help != false) {
            // var c = app.HELP_ROOT;
            // if (b.help && b.help.url) {
                // c = b.help.url
            // }
            // d.push(Ext.create("ca.esri.core.tool.help.ToolbarButton", {
                // helpUrl: c
            // }))
        // }
        if (b.about && b.about.urls) {
            d.push(Ext.create("ca.esri.core.tool.about.ToolbarButton", {
                urls: b.about.urls
            }))
        }
        if (b.measure != false) {
            d.push(Ext.create("ca.esri.core.tool.measure.ToolbarButton"))
        }
        // if (b.printmap != false) {
            // d.push(Ext.create("ca.esri.core.tool.printmap.ToolbarButton"))
        // }
        if (b.link != false) {
            d.push(Ext.create("ca.esri.core.tool.link.ToolbarButton"))
        }
        return d
    },
    getAppDivHeight: function () {
        var b;
        if (typeof (window.innerWidth) === "number") {
            b = window.innerHeight
        } else {
            if (document.documentElement && (document.documentElement.clientWidth || document.documentElement.clientHeight)) {
                b = document.documentElement.clientHeight
            }
        }
        return b - Ext.get("extjsApp").getBox().y
    },
    getWindowWidth: function () {
        var b = 0;
        if (window.innerHeight) {
            b = window.innerWidth
        } else {
            if (document.documentElement && document.documentElement.clientHeight) {
                b = document.documentElement.clientWidth
            } else {
                if (document.body) {
                    b = document.body.clientWidth
                }
            }
        }
        return b
    },
    getAppDivWidth: function () {
        return this.getWindowWidth() - 20
    },
    addTool: function (d, g, b, e) {
        var f = "0 3 2 0";
        if (b.indexOf("right") > -1) {
            f = "0 0 2 3"
        }
        var c = Ext.create("Ext.Button", {
            iconCls: d,
            tooltip: g,
            cls: b,
            scope: this,
            scale: "large",
            handler: e,
            margin: f
        });
        this.toolbar.add(c)
    },
    getParameters: function (c) {
        var k = {};
        c = c || window.location.href;
        var g = c.indexOf("?");
        if (g > -1) {
            var b = c.substring(g + 1);
            var e, j, h;
            var d = b.split(/[&]/);
            for (var f = 0; f < d.length; f++) {
                e = d[f].split("=");
                if (e[0]) {
                    j = decodeURIComponent(e[0]).toUpperCase();
                    h = e[1] || "";
                    h = decodeURIComponent(h);
                    h = Ext.util.Format.trim(h);
                    g = h.indexOf("#");
                    if (g > 0) {
                        h = h.substring(0, g)
                    }
                    k[j] = h
                }
            }
        }
        return k
    },
    getAppHelpUrl: function () {
        return app.HELP_ROOT
    },
    openHelp: function (c, b, d) {
        if (c === undefined) {
            alert(this.$className + ".openHelpWindow requires a url parameter be passed.");
            return
        }
        if (b === undefined) {
            b = "help"
        }
        if (d === undefined) {
            d = [(Ext.isIE ? "location=yes" : "location=no"), "menubar=no", "status=no", "titlebar=no", "scrollbars=yes", (Ext.isIE ? "toolbar=no" : "toolbar=yes")].join(",")
        }
        window.open(c, b, d)
    },
    setTitle: function (b) {
        if (b) {
            var e = document.getElementsByTagName("h1")[0];
            if (e) {
                var d = e.firstChild;
                d.nodeValue = b;
                document.title = b
            }
            app.locale.add("ApplicationTitle", b);
            var c = this.getAppDivHeight();
            Ext.getCmp("Core_Container").setHeight(c);
            Ext.getCmp("Core_Container").doLayout();
            if (this.map) {
                this.map.resize()
            }
        }
    },
    setServiceTitle: function (d, b) {
        var e = null;
        console.log("setServiceTitle");
        console.log(d);
        if (d != null && d.documentInfo != null) {
            e = d.documentInfo.Title
        }
        if (e == null || e.length < 1) {
            var c = b.url.indexOf("/MapServer");
            if (c < 0) {
                c = b.url.indexOf("/FeatureServer")
            }
            if (c < 0) {
                c = b.url.indexOf("/ImageServer")
            }
            if (c > 0) {
                var f = b.url.lastIndexOf("/", c - 1);
                e = b.url.substring(f + 1, c)
            } else {
                console.log("ca.esri.core.Application.getServiceTitle - unknown service type")
            }
        }
        console.log(e);
        console.log(b.title);
        if (e != null && e.length > 0) {
            console.log("setting title on service");
            b.title = e
        }
        return e
    },
    destroy: function () {
        alert(this.$className + ".destroy - Is this ever happening?");
        dojo.disconnect(this.mapOnLoadHandler);
        dojo.disconnect(this.mapOnUpdateStartHandler);
        dojo.disconnect(this.mapOnUpdateEndHandler);
        this.callParent(arguments)
    }
});
REVISION_NUMBER = "29653";
Ext.define("ca.esri.core.tool.dynamicrenderer.ToolbarButton", {
    extend: "ca.esri.core.tool.ToolbarButton",
    uses: ["ca.esri.core.tool.dynamicrenderer.locale." + dojo.locale, "ca.esri.core.tool.dynamicrenderer.Window"],
    iconCls: "icon-renderer",
    side: "right",
    textKey: "DRText",
    tooltipKey: "DRTooltip",
    winLcl: "ca.esri.core.tool.dynamicrenderer.locale.",
    winCls: "ca.esri.core.tool.dynamicrenderer.Window",
    service: null,
    initComponent: function () {
        if (this.service === null) {
            alert(this.$className + ".constructor requires a service be passed in the config.");
            return
        }
        this.winCfg = {
            service: this.service
        };
        this.callParent(arguments)
    }
});
Ext.define("ca.esri.core.tool.layerlist.FeatureServicesPanel", {
    extend: "ca.esri.core.tool.layerlist.ServicesPanel",
    id: "FeatureServicesPanel",
    region: "north",
    height: 150,
    getTitle: function () {
        return app.locale.i18n("LayerListFeatureLayers")
    },
    hidden: true,
    initComponent: function () {
        this.callParent(arguments);
        for (var b = 0; b < app.map.graphicsLayerIds.length; b++) {
            serviceId = app.map.graphicsLayerIds[b];
            service = app.map.getLayer(serviceId);
            this.addService(service)
        }
    },
    getIdsArray: function () {
        return app.map.graphicsLayerIds
    },
    removeService: function (b) {
        if (!(b instanceof esri.layers.GraphicsLayer)) {
            return false
        }
        this.callParent(arguments);
        if (this.panel.getRootNode().childNodes && this.panel.getRootNode().childNodes.length < 1) {
            this.hide()
        }
    },
    addService: function (b, c) {
        if (!(c === null || c === undefined)) {
            return false
        } else {
            if (b.isAPopupFeatureLayer === true) {
                return false
            }
        }
        if (b instanceof esri.layers.GraphicsLayer) {
            if (!this.callParent(arguments)) {
                return false
            }
        } else {
            return false
        }
        if (this.hidden) {
            this.show()
        }
        this.createTreeStore({
            text: b.name,
            id: b.id,
            service: b,
            children: [],
            leaf: true,
            cls: this.getCls(b),
            iconCls: "icon-layer",
            minScale: b.minScale,
            maxScale: b.maxScale,
            checked: b.visible
        })
    }
});
Ext.define("ca.esri.core.tool.layerlist.MappingServicesPanel", {
    extend: "ca.esri.core.tool.layerlist.ServicesPanel",
    id: "MappingServicesPanel",
    region: "center",
    getTitle: function () {
        return app.locale.i18n("LayerListMapLayers")
    },
    initComponent: function () {
        this.callParent(arguments);
        for (var b = 0; b < app.map.layerIds.length; b++) {
            serviceId = app.map.layerIds[b];
            service = app.map.getLayer(serviceId);
            this.addService(service)
        }
    },
    getIdsArray: function () {
        return app.map.layerIds
    },
    removeService: function (b) {
        if (b instanceof esri.layers.GraphicsLayer) {
            return
        }
        this.callParent(arguments)
    },
    addService: function (b, d) {
        if (!(d === null || d === undefined)) {
            return false
        }
        if (b instanceof esri.layers.GraphicsLayer) {
            return false
        }
        if (!this.callParent(arguments)) {
            return false
        }
        var h = null;
        if (b.visibleLayers && b.visibleLayers.length > 0 && b.visibleLayers[0] != -1) {
            h = b.visibleLayers
        }
        var j = false;
        var g = false;
        if (!b.title && b.url) {
            g = true
        }
        var f = {
            text: b.title,
            id: b.id,
            service: b,
            iconCls: "icon-group",
            checked: b.visible,
            minScale: b.minScale,
            maxScale: b.maxScale,
            children: []
        };
        if (b instanceof esri.layers.ArcGISImageServiceLayer) {
            f.iconCls = "icon-layer"
        } else {
            if (b instanceof esri.layers.OpenStreetMapLayer) {
                f.text = "OpenStreetMap";
                f.iconCls = "icon-layer"
            } else {
                if (b instanceof esri.layers.WMSLayer) {
                    f.children = this.getWMSLayerChildren(b, b.layerInfos)
                } else {
                    if (b instanceof esri.layers.ArcGISDynamicMapServiceLayer || b instanceof esri.layers.ArcGISTiledMapServiceLayer) {
                        j = true;
                        var c = [];
                        for (var e = 0; e < b.layerInfos.length; e++) {
                            if (!(b.layerInfos[e].parentLayerId > -1)) {
                                c.push(b.layerInfos[e].id)
                            }
                        }
                        f.children = this.getArcGISMapServiceLayerChildren(b, c);
                        if (b.visibleLayers && b.setVisibleLayers) {
                            b.setVisibleLayers(b.visibleLayers)
                        }
                        this.updatePopupFeatureLayerVisibility(b)
                    } else {
                        alert(this.$className + ".addService - Unknown esri.layers type");
                        return false
                    }
                }
            }
        }
        if (f.children.length > 0) {
            f.leaf = false
        } else {
            f.leaf = true
        }
        this.createTreeStore(f);
        if (j) {
            Ext.data.JsonP.request({
                url: b.url + "/exts/MetadataSoe",
                params: {
                    f: "pjson"
                },
                callbackKey: "callback",
                scope: this,
                success: function (k) {
                    if (k.name === "Metadata SOE") {
                        var m = this.parentTreeStore.findByRawValue(this.parentTreeStore.getRootNode(), "id", b.id);
                        if (m) {
                            m.cascadeBy(function (n) {
                                if (n.isLeaf()) {
                                    n.raw.hasMetadata = true;
                                    n.set("hasMetadata", true);
                                    n.commit()
                                }
                            })
                        }
                    }
                }
            })
        }
        if (g) {
            Ext.data.JsonP.request({
                url: b.url,
                params: {
                    f: "pjson"
                },
                callbackKey: "callback",
                scope: this,
                success: function (k) {
                    var o = app.setServiceTitle(k, b);
                    var n = this.parentTreeStore.getRootNode().childNodes;
                    for (var m = 0; m < n.length; m++) {
                        if (n[m].raw.service === b) {
                            n[m].raw.text = o;
                            n[m].set("text", o);
                            n[m].commit();
                            break
                        }
                    }
                }
            })
        }
    },
    getArcGISMapServiceLayerChildren: function (d, f) {
        var h = [];
        if (f) {
            for (var c = 0, b = f.length; c < b; c++) {
                var e = d.layerInfos[f[c]];
                if (e) {
                    var g = this.getArcGISMapServiceLayerChildren(d, e.subLayerIds);
                    h.push(this.getNodeCfg(d, g, e));
                    if (d.visibleLayers && d.setVisibleLayers) {
                        var j = Ext.Array.indexOf(d.visibleLayers, e.id);
                        if (g.length > 0 && j > -1) {
                            d.visibleLayers.splice(j, 1)
                        }
                    }
                }
            }
        }
        return h
    },
    getWMSLayerChildren: function (d, j) {
        var g = [];
        if (j) {
            for (var c = 0, b = j.length; c < b; c++) {
                var e = j[c];
                if (e) {
                    var f = this.getWMSLayerChildren(d, e.subLayers);
                    var h = this.getNodeCfg(d, f, e);
                    g.push(h)
                }
            }
        }
        return g
    },
    getNodeCfg: function (b, f, d) {
        var c = this.getCls(d);
        var e = d.name;
        var h = d.id;
        if (d.title) {
            e = d.title;
            if (f.length === 0) {
                h = d.name
            } else {
                h = d.title
            }
        }
        var g = (d.defaultVisibility) ? d.defaultVisibility : false;
        if (b.visibleLayers && Ext.Array.indexOf(b.visibleLayers, h) > -1) {
            g = true
        }
        return {
            text: e,
            id: h,
            children: f,
            leaf: (f.length === 0),
            cls: c,
            iconCls: (f.length === 0) ? "icon-layer" : "icon-group",
            minScale: d.minScale,
            maxScale: d.maxScale,
            checked: g
        }
    }
});
Ext.define("ca.esri.core.tool.layerlist.Window", {
    extend: "Ext.window.Window",
    uses: ["ca.esri.core.tool.layerlist.FeatureServicesPanel", "ca.esri.core.tool.layerlist.MappingServicesPanel"],
    id: "LayerListWindow",
    constrainHeader: true,
    shadow: false,
    collapsible: true,
    bodyPadding: 7,
    margin: 3,
    defaults: {
        style: {
            margin: "3px"
        }
    },
    // tools: [{
        // type: "help",
        // handler: function (d, e, b, c) {
            // app.openHelp(app.HELP_ROOT + "#con")
        // }
    // }],
    layout: "border",
    width: 300,
    height: 500,
    closeAction: "hide",
    featureServicesPanel: null,
    mappingServicesPanel: null,
    initComponent: function () {
        this.callParent(arguments);
        this.title = app.locale.i18n("LayerListTitle");
        this.featureServicesPanel = Ext.create("ca.esri.core.tool.layerlist.FeatureServicesPanel");
        this.mappingServicesPanel = Ext.create("ca.esri.core.tool.layerlist.MappingServicesPanel");
        this.add(this.mappingServicesPanel);
        this.add(this.featureServicesPanel);
        this.on("afterrender", this.onAfterRender)
    },
    onAfterRender: function (c, b) {
        this.setPosition(15, app.toolbar.getEl().getBox().bottom)
    }
});
Ext.define("ca.esri.core.tool.layerlist.ToolbarButton", {
    extend: "ca.esri.core.tool.ToolbarButton",
    uses: ["ca.esri.core.tool.layerlist.locale." + dojo.locale, "ca.esri.core.tool.layerlist.Window"],
    iconCls: "icon-layerlist",
    textKey: "LayerListText",
    tooltipKey: "LayerListTooltip",
    winLcl: "ca.esri.core.tool.layerlist.locale.",
    winCls: "ca.esri.core.tool.layerlist.Window"
});