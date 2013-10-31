/**************************************************
 ESRI Mapping Application Framework Library
**************************************************/
Ext.define("ca.esri.apps.view_vis.locale.en", {
    addStrings: function () {
        app.locale.add("ApplicationTitle", "Geospatial Platform Viewer");
        app.locale.add("UMAPMapIdNotLoaded", "An error occurred. The Web Application is not available");
        app.locale.add("UMAPLoadingWebAppInProgress", "<br>&nbsp;&nbsp;&nbsp;<b>Loading Web Application in progress...</b>&nbsp;&nbsp;&nbsp;<br><br>");
        app.locale.add("UMAPInvalidToken", "This Web Application needs a valid username and password in order to see the map information");
        app.locale.add("UMAPFeatureLayersNotSupported", "ESRI Feature Layers cannot be added to this application dynamically. Try removing the integer at the end of the URL.");
        app.locale.add("UMAPFeatureServicesNotSupported", "ESRI Feature Services cannot be added to this application dynamically.")
    }
});
Ext.define("ca.esri.apps.view_vis.locale.fr", {
    addStrings: function () {
        app.locale.add("ApplicationTitle", "Plate-forme de visualisation géospatiale");
        app.locale.add("UMAPMapIdNotLoaded", "Une erreur s'est produite. L'application Web n'est pas disponible");
        app.locale.add("UMAPLoadingWebAppInProgress", "<br>&nbsp;&nbsp;&nbsp;<b>Chargement de l'application Web en cours...</b>&nbsp;&nbsp;&nbsp;<br><br>");
        app.locale.add("UMAPInvalidToken", "Cette application Web a besoin d'un nom d'utilisateur et d'un mot de passe valides afin d'afficher les informations de la carte");
        app.locale.add("UMAPFeatureLayersNotSupported", "Les couches d'entité d'ESRI ne peuvent être ajoutées à cette application de façon dynamique. Essayer d'enlever le nombre entier à la fin de l'adresse URL.");
        app.locale.add("UMAPFeatureServicesNotSupported", "Les services d'entité d'ESRI ne peuvent être ajoutés à cette application de façon dynamique.")
    }
});
Ext.define("ca.esri.apps.view_vis.tool.about.Window", {
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
    panel: null,
    initComponent: function () {
        this.callParent(arguments);
        this.title = app.locale.i18n("AboutTitle");
        this.panel = Ext.create("Ext.panel.Panel", {
            html: this.content,
            autoScroll: true,
            bodyPadding: 7
        });
        this.add(this.panel)
    },
    destroy: function () {
        this.callParent(arguments)
    }
});
Ext.define("ca.esri.apps.view_vis.tool.about.locale.en", {
    addStrings: function () {
        app.locale.add("AboutText", "About");
        app.locale.add("AboutTooltip", "About this map");
        app.locale.add("AboutTitle", "About");
        app.locale.add("AboutEmptyContent", "No description found.")
    }
});
Ext.define("ca.esri.apps.view_vis.tool.about.locale.fr", {
    addStrings: function () {
        app.locale.add("AboutText", "À propos");
        app.locale.add("AboutTooltip", "À propos de cette carte");
        app.locale.add("AboutTitle", "À propos");
        app.locale.add("AboutEmptyContent", "Aucune description trouvée.")
    }
});
Ext.define("ca.esri.apps.view_vis.tool.about.ToolbarButton", {
    extend: "ca.esri.core.tool.ToolbarButton",
    uses: ["ca.esri.apps.view_vis.tool.about.locale." + dojo.locale, "ca.esri.apps.view_vis.tool.about.Window"],
    side: "right",
    textKey: "AboutText",
    tooltipKey: "AboutTooltip",
    winLcl: "ca.esri.apps.view_vis.tool.about.locale.",
    winCls: "ca.esri.apps.view_vis.tool.about.Window",
    cls: "no-icon-toolbarbutton",
    content: null,
    initComponent: function () {
        if (!this.content || this.content.length < 1) {
            this.content = app.locale.i18n("AboutEmptyContent")
        }
        this.winCfg = {
            content: this.content
        };
        this.callParent(arguments)
    },
    setContent: function (a) {
        if (a === null) {
            return
        }
        this.winCfg = {
            content: a
        };
        if (this.window != null) {
            this.window.content = a
        }
    }
});
dojo.require("esri.arcgis.utils");
dojo.require("esri.IdentityManager");
Ext.define("ca.esri.apps.view_vis.Application", {
    extend: "ca.esri.core.Application",
    name: "ca.esri.apps.view_vis.Application",
    uses: ["ca.esri.apps.view_vis.locale." + dojo.locale, "ca.esri.apps.view_vis.tool.about.ToolbarButton", "ca.esri.core.tool.legend.ToolbarButton", "ca.esri.core.tool.addlayer.AddData"],
    layerInfos: [],
    btnAbout: null,
    description: null,
    addData: null,
    constructor: function (a) {
        if (a === undefined || a === null) {
            a = {}
        }
        this.initConfig(a);
        this.callParent([a]);
        this.APP_ROOT = [this.APP_ROOT, "/view_vis"].join("");
        this.HELP_ROOT = [this.HELP_ROOT, "1369755927040"].join("")
    },
    cbCreateMap: function (a) {
        this.map = a.map;
        this.initExtent = this.map.extent;
        ca.esri.apps.view_vis.Application.superclass.initMap.apply(this, arguments);
        this.setTitle(a.itemInfo.item.title);
        this.setDescription(a.itemInfo.item.description);
        this.layerInfos = esri.arcgis.utils.getLegendLayers(a);
        this.setWebMapVisibility(a.itemInfo.itemData.operationalLayers);
        this.initPopupLayers(a.itemInfo.itemData.operationalLayers);
        this.closeLoadingMask()
    },
    setDescription: function (a) {
        if (a) {
            this.description = a;
            if (this.btnAbout != null) {
                this.btnAbout.setContent(a)
            }
        }
    },
    displayError: function (a) {
        Ext.Msg.alert(app.locale.i18n("AddLayerErrorDialogTitle"), app.locale.i18n(a), dojo.hitch(this, function () {
            this.setTitle(app.locale.i18n("UMAPMapIdNotLoaded"))
        }))
    },
    setWebMapVisibility: function (b) {
        for (var a = 0; a < b.length; a++) {
            if (b[a].layerObject) {
                b[a].layerObject.title = b[a].title;
                if (b[a].layerObject.setVisibleLayers) {
                    if (b[a].visibleLayers) {
                        b[a].layerObject.setVisibleLayers(b[a].visibleLayers)
                    }
                } else {
                    b[a].layerObject.setVisibility(b[a].visibility)
                }
            }
        }
    },
    initPopupLayers: function (d) {
        var g = null;
        var b = null;
        var m = null;
        for (var f = 0; f < d.length; f++) {
            if (d[f].layers != null) {
                for (var e = 0; e < d[f].layers.length; e++) {
                    g = d[f].layers[e];
                    if (g.popupInfo != null) {
                        b = [d[f].layerObject.id, "_", g.id].join("");
                        m = this.map._layers[b];
                        if (m == null) {
                            var a = [d[f].url, "/", g.id].join("");
                            var h = [];
                            for (var c = 0; c < g.popupInfo.fieldInfos.length; c++) {
                                if (g.popupInfo.fieldInfos[c].visible) {
                                    h.push(g.popupInfo.fieldInfos[c].fieldName)
                                }
                            }
                            var l = new esri.dijit.PopupTemplate(g.popupInfo);
                            var m = new esri.layers.FeatureLayer(a, {
                                id: b,
                                infoTemplate: l,
                                mode: esri.layers.FeatureLayer.MODE_SELECTION,
                                outFields: h
                            });
                            dojo.connect(m, "onClick", this, function (i) {
                                this.map.infoWindow.setFeatures([i.graphic])
                            });
                            this.map.addLayer(m)
                        }
                        m.isAPopupFeatureLayer = true;
                        if (d[f].layerObject.popupFeatureLayers == null) {
                            d[f].layerObject.popupFeatureLayers = {}
                        }
                        d[f].layerObject.popupFeatureLayers[g.id] = m;
                        if (Ext.Array.indexOf(d[f].layerObject.visibleLayers, g.id) > -1) {
                            m.setVisibility(true)
                        } else {
                            m.setVisibility(false)
                        }
                    }
                }
            }
        }
    },
    initMap: function () {
        Ext.create("ca.esri.apps.view_vis.locale." + dojo.locale).addStrings();
        if (this.params.WEBMAP) {
            this.showLoadingMask(app.locale.i18n("UMAPLoadingWebAppInProgress"));
            var a = esri.arcgis.utils.createMap(this.params.WEBMAP, this.pnlMap.getContentTarget().id, {
                mapOptions: {
                    wrapAround180: true,
                    logo: false,
                    sliderStyle: "large"
                }
            });
            a.then(dojo.hitch(this, this.cbCreateMap), dojo.hitch(this, function (b) {
                if (b.message.indexOf("ABORTED") > -1) {
                    this.initBasicMapAndTools()
                } else {
                    if (b.fileName && b.fileName.indexOf("IdentityManager.js") != -1) {
                        this.displayError("UMAPInvalidToken")
                    } else {
                        this.displayError(b)
                    }
                }
                this.closeLoadingMask()
            }))
        } else {
            this.initBasicMapAndTools()
        }
    },
    initBasicMapAndTools: function () {
        this.initExtent = new esri.geometry.Extent({
            xmin: -14734647,
            ymin: 5119940,
            xmax: -5862275,
            ymax: 8219011,
            spatialReference: {
                wkid: 102100
            }
        });
        this.basemap1 = new esri.layers.ArcGISTiledMapServiceLayer("http://services.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer");
        this.basemap1.includeInLegend = false;
        this.basemap1.basemapGalleryLayerType = "basemap";
        ca.esri.apps.view_vis.Application.superclass.initMap.apply(this, arguments);
        this.map.addLayers([this.basemap1])
    },
    addTools: function () {
        var c = this.callParent([{
            help: {
                url: this.getAppHelpUrl()
            },
            legend: false
        }]);
        this.btnAbout = Ext.create("ca.esri.apps.view_vis.tool.about.ToolbarButton", {
            content: this.description
        });
        for (var a = 0; a < c.length; a++) {
            if ((c[a] instanceof ca.esri.core.tool.help.ToolbarButton)) {
                c.splice(a + 1, 0, this.btnAbout);
                break
            }
        }
        var b = Ext.create("ca.esri.core.tool.legend.ToolbarButton", {
            layerInfos: this.layerInfos
        });
        c.splice(0, 0, b);
        return c
    },
    onMapCreated: function (b) {
        this.callParent([b]);
        if (this.params.ESRISERVICE || this.params.OGCSERVICE) {
            this.showLoadingMask();
            this.addData = Ext.create("ca.esri.core.tool.addlayer.AddData", {
                success: dojo.hitch(this, this.handleSuccessAddingLayer),
                failure: dojo.hitch(this, this.handleErrorAddingLayer)
            });
            if (this.params.ESRISERVICE) {
                var a = this.params.ESRISERVICE.slice(-1);
                if (/^\d+$/.test(a)) {
                    Ext.Msg.alert(app.locale.i18n("AddLayerErrorDialogTitle"), app.locale.i18n("UMAPFeatureLayersNotSupported"));
                    return
                }
                if (this.params.ESRISERVICE.endsWith("/FeatureServer") || this.params.ESRISERVICE.endsWith("/FeatureServer/")) {
                    Ext.Msg.alert(app.locale.i18n("AddLayerErrorDialogTitle"), app.locale.i18n("UMAPFeatureServicesNotSupported"));
                    return
                }
                this.addData.addMapService(this.params.ESRISERVICE)
            } else {
                if (this.params.OGCSERVICE) {
                    this.addData.addWms(this.params.OGCSERVICE)
                }
            }
        }
    },
    handleSuccessAddingLayer: function () {
        var b = this.addData.getLayers();
        if (b === null || b.length < 1) {
            return
        }
        this.map.reorderLayer(b[0], 1);
        for (var a = 0; a < this.toolbar.items.items.length; a++) {
            if (this.toolbar.items.items[a] instanceof ca.esri.core.tool.layerlist.ToolbarButton) {
                this.toolbar.items.items[a].handler(this.toolbar.items.items[a]);
                break
            }
        }
        if (this.params.ESRISERVICE) {
            Ext.data.JsonP.request({
                url: b[0].url,
                params: {
                    f: "pjson"
                },
                callbackKey: "callback",
                scope: this,
                success: function (c) {
                    var d = this.setServiceTitle(c, b[0]);
                    if (d != null && d.length > 0) {
                        this.setTitle(d)
                    }
                    if (c.serviceDescription != null && c.serviceDescription.length > 0) {
                        b[0].description = c.serviceDescription
                    } else {
                        b[0].description = app.locale.i18n("AboutEmptyContent")
                    }
                    this.setDescription(b[0].description)
                },
                failure: function () {
                    console.log("Failure - callback for " + b[0].url)
                }
            })
        } else {
            if (this.params.OGCSERVICE) {
                this.setDescription(b[0].description);
                this.setTitle(b[0].title)
            }
        }
        this.hideLoadingMask()
    },
    handleErrorAddingLayer: function (b) {
        this.hideLoadingMask();
        var a = this.addData.getErrorAddingLayerMessage(b);
        Ext.Msg.alert(app.locale.i18n("AddLayerErrorDialogTitle"), a)
    }
});
REVISION_NUMBER = "29494";