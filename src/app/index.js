//
// Copyright (C) 2017 University of Dundee & Open Microscopy Environment.
// All rights reserved.
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as
// published by the Free Software Foundation, either version 3 of the
// License, or (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.
//

// images
require('../../node_modules/bootstrap/fonts/glyphicons-halflings-regular.woff');
require('../../node_modules/jquery-ui/themes/base/images/ui-icons_777777_256x240.png');
require('../../node_modules/jquery-ui/themes/base/images/ui-icons_555555_256x240.png');
require('../../node_modules/jquery-ui/themes/base/images/ui-icons_ffffff_256x240.png');
require('../../node_modules/jquery-ui/themes/base/images/ui-icons_444444_256x240.png');


// js
import {inject} from 'aurelia-framework';
import Context from './context';
import Misc from '../utils/misc';
import OpenWith from '../utils/openwith';
import {Utils} from '../utils/regions';
import Ui from '../utils/ui';
import {PLUGIN_PREFIX, SYNC_LOCK, WEBGATEWAY} from '../utils/constants';
import {
    IMAGE_SETTINGS_REFRESH,
    IMAGE_CANVAS_DATA,
    IMAGE_INTENSITY_QUERYING,
    IMAGE_VIEWER_CONTROLS_VISIBILITY,
    IMAGE_VIEWER_RESIZE,
    IMAGE_VIEWER_INTERACTION,
    IMAGE_SETTINGS_CHANGE,
    VIEWER_PROJECTIONS_SYNC,
    IMAGE_DIMENSION_CHANGE,
    IMAGE_COMMENT_CHANGE,
    IMAGE_DIMENSION_PLAY,
    IMAGE_VIEWPORT_CAPTURE,
    IMAGE_VIEWPORT_LINK,
    REGIONS_SET_PROPERTY,
    REGIONS_PROPERTY_CHANGED,
    REGIONS_DRAW_SHAPE,
    REGIONS_SHAPE_GENERATED,
    REGIONS_CHANGE_MODES,
    REGIONS_SHOW_COMMENTS,
    ENABLE_SHAPE_POPUP,
    REGIONS_GENERATE_SHAPES,
    REGIONS_STORE_SHAPES,
    REGIONS_STORED_SHAPES,
    REGIONS_MODIFY_SHAPES,
    VIEWER_IMAGE_SETTINGS,
    VIEWER_SET_SYNC_GROUP,
    REGIONS_HISTORY_ENTRY,
    REGIONS_HISTORY_ACTION,
    REGIONS_COPY_SHAPES,
    HISTOGRAM_RANGE_UPDATE,
    THUMBNAILS_UPDATE,
    SAVE_ACTIVE_IMAGE_SETTINGS,
    VIEWER_SET_REGIONS_VISIBILITY,
    VIEWER_REMOVE_INTERACTION_OR_CONTROL,
    VIEWER_SET_SHAPE_POPUP_VISIBILITY,
    VIEWER_INITIALIZED,
    VIEWER_SELECT_SHAPES,
    UI_MODIFY,
    VIEWER_SET_REGIONS_MODES,
    VIEWER_ZOOM_TO_FIT,
} from '../events/events';

/**
 * @classdesc
 *
 * The index view/page so to speak
 */
@inject(Context)
export class Index  {
    /**
     * the handle on the the resize function (from setTimeout)
     * @memberof Index
     * @type {number}
     */
    resizeHandle = null;

    /**
     * a prefix for the full screen api methods
     * @memberof Index
     * @type {string}
     */
    full_screen_api_prefix = null;

    /**
     * @memberof Index
     * @type {boolean}
     */
    restoreMDI = false;

    /**
     * array of possible sync locks
     * @memberof Index
     * @type {Array.<Object>}
     */
    sync_locks = [
        SYNC_LOCK.ZT,
        SYNC_LOCK.VIEW,
        SYNC_LOCK.CHANNELS
    ];

    /**
     * randomly generated id for this viewer. Used in VQuest to
     * target this viewer when multiple are in use
     * @memberof Index
     * @type {string}
     */
    my_id = '';

    /**
     * @constructor
     * @param {Context} context the application context
     */
    constructor(context) {
        this.context = context;
    }

    /**
     * Overridden aurelia lifecycle method:
     * fired when PAL (dom abstraction) is ready for use
     *
     * @memberof Index
     */
    attached() {
        // listen to resizing of the browser window
        let publishResize =
            () => this.context.publish(
                IMAGE_VIEWER_RESIZE,
                {config_id: -1, window_resize: true});
        window.onresize = () => {
            if (typeof this.resizeHandle !== null) {
                clearTimeout(this.resizeHandle);
                this.resizeHandle = null;
            }
            this.resizeHandle = setTimeout(publishResize, 50);
        };
        window.onbeforeunload = () => {
            if (Misc.useJsonp(this.context.server)) return null;
            let hasBeenModified = false;
            for (var [k,v] of this.context.image_configs) {
                if (v && v.regions_info && v.regions_info.hasBeenModified() &&
                    v.regions_info.image_info.can_annotate) {
                    hasBeenModified = true;
                    break;
                }
            }
            if (hasBeenModified)
                return "You have new/deleted/modified ROI(s).\n" +
                        "If you leave you'll lose your changes.";
            return null;
        };
        // TODO(Clovid): refactor
        if (window !== window.parent) {
            this.handleIframeConnection()
        }
        // register resize and collapse handlers
        Ui.registerSidePanelHandlers(
            this.context.eventbus,
            this.context.getPrefixedURI(PLUGIN_PREFIX, true),
        );

        // register the fullscreenchange handler
        this.full_screen_api_prefix = Ui.getFullScreenApiPrefix();
        if (this.full_screen_api_prefix &&
            typeof document['on' +
                this.full_screen_api_prefix + 'fullscreenchange'] !== 'function')
                document['on' +
                    this.full_screen_api_prefix + 'fullscreenchange'] =
                        () => this.onFullScreenChange();

        // fetch open with scripts
        OpenWith.fetchOpenWithScripts(
            this.context.server + this.context.getPrefixedURI(WEBGATEWAY));
    }

    /**
     * Closes viewer in MDI mode checking whether there is a need
     * to store
     *
     * @memberof Index
     */
    closeViewerInMDI(id) {
        if (!this.context.useMDI) return;

        let conf = this.context.getImageConfig(id);
        if (conf === null || conf.regions_info === null ||
            !conf.regions_info.hasBeenModified() ||
            Misc.useJsonp(this.context.server) ||
            !conf.regions_info.image_info.can_annotate) {
                this.context.removeImageConfig(id);
                return;
            };

            let saveHandler = () => {
                let tmpSub =
                    this.context.eventbus.subscribe(
                        REGIONS_STORED_SHAPES,
                        (params={}) => {
                            tmpSub.dispose();
                            this.context.removeImageConfig(id);
                    });
                setTimeout(()=>
                    this.context.publish(
                        REGIONS_STORE_SHAPES,
                        {config_id : conf.id,
                         omit_client_update: true}), 20);
            };
            Ui.showConfirmationDialog(
                'Save ROIs?',
                'You have new/deleted/modified ROI(s).<br>' +
                'Do you want to save your changes?',
                saveHandler, () => this.context.removeImageConfig(id));
    }

    /**
     * Adds/Removes the given image config to the sync group
     * @param {number} id the image config id
     * @param {string|null} group the sync group or null
     * @memberof Index
     */
    toggleSyncGroup(id, group=null) {
        let conf = this.context.getImageConfig(id);
        if (conf === null) return;

        conf.toggleSyncGroup(group);
        this.context
    }

    /**
     * Visually highlights image configs contained in group
     * @param {Array.<number>} group the group containing the image configs
     * @param {boolean} flag if true we highlight, otherwise not
     * @memberof Index
     */
    highlightSyncGroup(group = [], flag) {
        for (let g in group)
            $('#' + group[g]).css("border-color", flag ? "yellow" : "");
    }

    /**
     * Turns on/off syncing locks
     *
     * @param {number} id the image config id
     * @param {string} lock the sync lock, e.g. z, t, c or v
     * @param {boolean} flag if true the lock is applied, otherwise not
     * @memberof Index
     */
    toggleSyncLock(id, lock = 'c', flag) {
        let conf = this.context.getImageConfig(id);
        if (conf === null || conf.sync_group === null) return;
        let syncGroup = this.context.sync_groups.get(conf.sync_group);
        if (syncGroup) {
            syncGroup.sync_locks[lock] = flag;
        }
    }

    /**
     * Shows/Hides viewer controls
     *
     * @param {number} id the image config id
     * @memberof Index
     */
    toggleViewerControlsInMDI(id) {
        let conf = this.context.getImageConfig(id);
        if (conf === null) return;

        this.context.publish(
            IMAGE_VIEWER_CONTROLS_VISIBILITY,
            {config_id : conf.id, flag: !conf.show_controls});
    }

    /**
     * Handles fullscreen changes
     *
     * @memberof Index
     */
    onFullScreenChange() {
        let isInFullScreen =
            document[this.full_screen_api_prefix + 'isFullScreen'] ||
            document[this.full_screen_api_prefix + 'FullScreen'] ||
            document[this.full_screen_api_prefix + 'FullscreenElement'];

        if (isInFullScreen) {
            this.restoreMDI = this.context.useMDI;
            if (this.restoreMDI) this.context.useMDI = false;
        } else {
            if (this.restoreMDI) this.context.useMDI = true;
        }
        $(".viewer-context-menu").hide();
    }

    /**
     * Handle dropping of a thumbnail on to the centre panel.
     * Opens the image in Multi-Display mode
     *
     * @param {Object} event Drop event
     */
    handleDrop(event) {
        var image_id = parseInt(event.dataTransfer.getData("id"), 10);
        this.context.useMDI = true;
        // similar behaviour to double-clicking
        this.context.onClicks(image_id, true);
    }

    /**
     * Simply preventDefault() to allow drop here
     *
     * @param {Object} event Dragover event
     */
    handleDragover(event) {
        event.preventDefault();
    }

    /**
     * Overridden aurelia lifecycle method:
     * called when the view and its elemetns are detached from the PAL
     * (dom abstraction)
     *
     * @memberof Index
     */
    detached() {
        window.onresize = null;
        window.onbeforeunload = null;
        if (this.full_screen_api_prefix !== null &&
            document['on' +
                this.full_screen_api_prefix + 'fullscreenchange']) {
                document['on'
                    + this.full_screen_api_prefix + 'fullscreenchange'] = null;
        }
    }

    handleIframeConnection() {
        let iframeTarget;
        let viewerInitialized = false;
        const messageContext = 'clovid_integration'; // shared "secret"
        this.context.eventbus.subscribeOnce(
            VIEWER_INITIALIZED,
            () => {
                viewerInitialized = true;
                if (iframeTarget) {
                    finishIframeInitialization(this.context);
                }
            }
        );
        const finishIframeInitialization = (context) => {
            //context.publish(VIEWER_REMOVE_INTERACTION_OR_CONTROL, {args: ['fullscreen']});
            context.publish(VIEWER_SET_SHAPE_POPUP_VISIBILITY, false);
            parent.postMessage({
                context: messageContext,
                type: 'event',
                name: VIEWER_INITIALIZED,
                params: { 'iviewerid': this.my_id, 'vqvpid': context.vqvpid}
            }, '*');
            console.log('initialization between parent and iframe complete');
        }

        document.addEventListener('regions_information_retrieved', event => {
            const shapes = this.context.getSelectedImageConfig().regions_info.getAllShapeIds();

            parent.postMessage({
                context: messageContext,
                type: 'event',
                name: 'annotations_loaded',
                params: { 'iviewerid': this.my_id, 'vqvpid': this.context.vqvpid},
                payload: {
                    shapes,
                }
            }, '*');
        });
        window.addEventListener('message', event => {
            if (!event.data || !event.data.context || event.data.context !== messageContext || event.data.target !== this.my_id) {
                return;
            }
            const parentMessage = event.data;
            const regions_info = this.context.getSelectedImageConfig().regions_info;
            const config_id = regions_info.image_info.config_id;

            console.log('handle message from parent', parentMessage);
            if (parentMessage.type === 'event') {
                switch (parentMessage.name) {
                    case 'initialized':
                        iframeTarget = event.source;
                        this.initIframeSubscriptions(messageContext, iframeTarget)
                        this.context.publish(UI_MODIFY, {subject: 'sidebar_left', action: 'toggle'})
                        this.context.publish(UI_MODIFY, {subject: 'sidebar_right', action: 'toggle'})
                        this.context.publish(UI_MODIFY, {subject: 'header', action: 'hide'})
                        if (viewerInitialized) {
                            finishIframeInitialization(this.context)
                        }
                        break;
                    case 'prepare':
                        console.warn('DEPRECATION: please use "action" instead "event" for "prepare"');
                        this.temp_prepare();
                        break;
                    case 'newPoint': {
                        console.warn('DEPRECATION: please use "action" add_annotation instead "event" newPoint for adding new point');
                        this.temp_newPoint(parentMessage);
                        break;
                    }
                    case 'savePoint': {
                        console.warn('DEPRECATION: please use "action" save_annotation instead "event" savePoint for saving new point');
                        this.temp_savePoint();
                        break;
                    }
                    default:
                        break;
                }
            }
            if (parentMessage.type === 'action') {
                switch (parentMessage.name) {
                    case 'prepare':
                        this.temp_prepare();
                        break;
                    case 'zoom_to_fit':
                        this.context.publish(VIEWER_ZOOM_TO_FIT, null);
                        break;
                    case 'hide_all_annotations':
                        this.context.publish(VIEWER_SET_REGIONS_VISIBILITY, {args: [false]});
                        break;
                    case 'show_all_annotations':
                        this.context.publish(VIEWER_SET_REGIONS_VISIBILITY, {args: [true]});
                        break;
                    case 'show_header_actions':
                        this.context.publish(UI_MODIFY, {subject: 'header_actions', action: 'show'});
                        break;
                    case 'hide_header_actions':
                        this.context.publish(UI_MODIFY, {subject: 'header_actions', action: 'hide'});
                        break;
                    case 'add_annotation':
                        this.temp_newPoint(parentMessage);
                        break;
                    case 'cancel_annotation':
                        this.context.publish(REGIONS_DRAW_SHAPE, {
                            config_id,
                            shape: { type: null },
                            abort: true,
                            hist_id: regions_info.history.getHistoryId(),
                            roi_id: regions_info.getNewRegionsId()
                        });
                        break;
                    case 'save_annotation':
                        this.temp_savePoint();
                        break;
                    case 'deselect_annotation':
                        if (typeof parentMessage.payload.annotationId !== 'string') {
                            console.error('Wrong annotationId for deselect_annotation action provided', parentMessage.payload);
                            break;
                        }
                        this.context.publish(VIEWER_SELECT_SHAPES, {args: [
                            [parentMessage.payload.annotationId],
                            false
                        ]});
                        break;
                    case 'pan_to_annotation': // TODO: should zoom out so that the shape is completely visible
                        if (typeof parentMessage.payload.annotationId !== 'string') {
                            console.error('Wrong annotationId for pan_to_annotation action provided', parentMessage.payload);
                            break;
                        }
                        // * @param {Array<string>} roi_shape_ids list in roi_id:shape_id notation
                        // * @param {boolean} selected flag whether we should (de)select the rois
                        // * @param {boolean} clear flag whether we should clear existing selection beforehand
                        // * @param {string|null} panToShape the id of the shape to pan into view or null
                        // * @param {boolean} zoomToShape if true (and panToShape is specified) zoom it into view
                        // * @param {boolean} zoomOut if true (and zoomToShape is true) zoom out if neccessary
                        // * @param {boolean} onlyPanIfNeeded if true pans only if shape not in viewport
                        this.context.publish(VIEWER_SELECT_SHAPES, {args: [
                            [parentMessage.payload.annotationId],
                            !!parentMessage.payload.select,
                            true,
                            parentMessage.payload.annotationId,
                            false,
                            true,
                            true,
                        ]});
                        break;

                    case 'zoom_to_annotation':
                        if (typeof parentMessage.payload.annotationId !== 'string') {
                            console.error('Wrong annotationId for zoom_to_annotation action provided', parentMessage.payload);
                            break;
                        }
                        // * @param {Array<string>} roi_shape_ids list in roi_id:shape_id notation
                        // * @param {boolean} selected flag whether we should (de)select the rois
                        // * @param {boolean} clear flag whether we should clear existing selection beforehand
                        // * @param {string|null} panToShape the id of the shape to pan into view or null
                        // * @param {boolean} zoomToShape if true (and panToShape is specified) zoom it into view
                        // * @param {boolean} zoomOut if true (and zoomToShape is true) zoom out if neccessary
                        this.context.publish(VIEWER_SELECT_SHAPES, {args: [
                            [parentMessage.payload.annotationId],
                            !!parentMessage.payload.select,
                            true,
                            parentMessage.payload.annotationId,
                            true,
                            true
                        ]});
                        break;
                    case 'zoom_to_annotations':
                        if (!parentMessage.payload.annotationIds.length) {
                            console.warn('No annotations provided for zoom_to_annotations', parentMessage.payload);
                            break;
                        }
                        this.context.publish(VIEWER_SELECT_SHAPES, {args: [
                            parentMessage.payload.annotationIds,
                            false,
                            true,
                            parentMessage.payload.annotationIds,
                            true,
                            true
                        ]});
                    break;
                    case 'hide_annotations':
                        if (!parentMessage.payload.annotationIds.length) {
                            console.warn('No annotations provided for hide_annotations', parentMessage.payload);
                            break;
                        }
                        this.context.publish(VIEWER_SET_REGIONS_VISIBILITY, {args: [
                            false,
                            parentMessage.payload.annotationIds
                        ]});
                        break;
                    case 'show_annotations':
                        if (!parentMessage.payload.annotationIds.length) {
                            console.warn('No annotations provided for show_annotations', parentMessage.payload);
                            break;
                        }
                        this.context.publish(VIEWER_SET_REGIONS_VISIBILITY, {args: [
                            true,
                            parentMessage.payload.annotationIds
                        ]});
                        break;
                    case 'hide_navbar':
                        this.context.publish(UI_MODIFY, {subject: 'header', action: 'hide'});
                        break;
                    case 'show_navbar':
                        this.context.publish(UI_MODIFY, {subject: 'header', action: 'show'});
                        break;
                    case 'disable_interaction':
                        this.context.publish(VIEWER_SET_REGIONS_MODES, {args: ['select']});
                        break;
                    case 'enable_interaction':
                        this.context.publish(VIEWER_SET_REGIONS_MODES, {args: ['select', 'modify', 'translate']});
                        break;
                    case 'disable_comments':
                        this.context.publish(REGIONS_SHOW_COMMENTS, {config_id, value: false});
                        break;
                    case 'enable_comments':
                        this.context.publish(REGIONS_SHOW_COMMENTS, {config_id, value: true});
                        break;

                    default:
                        break;
                }
            }
        })
        var typedArray = new Uint8Array(10);
        crypto.getRandomValues(typedArray);
        for (var i=0; i<10; i++)
        {
          this.my_id += typedArray[i].toString(0xF);
        }
        parent.postMessage({
            context: messageContext,
            type: 'event',
            name: 'handshake',
            params: { 'iviewerid': this.my_id, 'vqvpid': this.context.vqvpid}
        }, '*')

    }

    // TODO: remove after prepare event is removed
    temp_prepare() {
        // Request the ROI data for this image and let it propagate through the framework
        this.context.getSelectedImageConfig().regions_info.requestData();
    }

    // remove after newPoint event is removed
    temp_newPoint(parentMessage) {
        const shapeType = (parentMessage.payload && parentMessage.payload.shapeType) || 'fixed_arrow';
        const shapeColor = parseInt((parentMessage.payload && parentMessage.payload.shapeColor)) || -65281;
        const shapeComment = (parentMessage.payload && parentMessage.payload.shapeComment);

        const regions_info = this.context.getSelectedImageConfig().regions_info;
        regions_info.shape_to_be_drawn = shapeType;
        const config_id = regions_info.image_info.config_id;
        const shape_definition = {
            ...regions_info.shape_defaults,
            type: shapeType,
            StrokeColor: shapeColor,
        }
        shape_definition.StrokeWidth.Value = 2;

        this.context.publish(REGIONS_DRAW_SHAPE, {
            config_id,
            abort: false,
            hist_id: regions_info.history.getHistoryId(),
            roi_id: regions_info.getNewRegionsId(),
            shape: shape_definition
        });

        this.context.eventbus.subscribeOnce(REGIONS_SHAPE_GENERATED, params => {
            if (params.config_id !== config_id) return;

            // Set comment if any
            if (shapeComment) {
                const shapeId = params.shapes[0].oldId;
                // from regions-edit.js
                const deltaProps = {type: shapeType, Text: shapeComment}
                const updates = { properties: ['Text'], values: [shapeComment] };
                const updateHandler = Utils.createUpdateHandler(updates);

                this.context.publish(
                    REGIONS_MODIFY_SHAPES,
                    {
                        config_id,
                        shapes: [shapeId],
                        modifies_attachment: false,
                        definition: deltaProps,
                        callback: updateHandler
                    }
                );
            }
            // Switch back to normal mode
            setTimeout(() => this.context.publish(REGIONS_DRAW_SHAPE, {config_id, abort: true}), 50);
        });
    }

    // remove after savePoint event is removed
    temp_savePoint() {
        const config_id = this.context.getSelectedImageConfig().regions_info.image_info.config_id;
        this.context.publish(REGIONS_STORE_SHAPES, { config_id });
    }

    initIframeSubscriptions(messageContext, iframeTarget) {
        [
            IMAGE_SETTINGS_REFRESH,
            IMAGE_CANVAS_DATA,
            IMAGE_INTENSITY_QUERYING,
            IMAGE_VIEWER_CONTROLS_VISIBILITY,
            IMAGE_VIEWER_RESIZE,
            IMAGE_VIEWER_INTERACTION,
            IMAGE_SETTINGS_CHANGE,
            VIEWER_PROJECTIONS_SYNC,
            IMAGE_DIMENSION_CHANGE,
            IMAGE_COMMENT_CHANGE,
            IMAGE_DIMENSION_PLAY,
            IMAGE_VIEWPORT_CAPTURE,
            IMAGE_VIEWPORT_LINK,
            REGIONS_SET_PROPERTY,
            REGIONS_PROPERTY_CHANGED,
            REGIONS_DRAW_SHAPE,
            REGIONS_SHAPE_GENERATED,
            REGIONS_CHANGE_MODES,
            REGIONS_SHOW_COMMENTS,
            ENABLE_SHAPE_POPUP,
            REGIONS_GENERATE_SHAPES,
            REGIONS_STORE_SHAPES,
            REGIONS_STORED_SHAPES,
            REGIONS_MODIFY_SHAPES,
            VIEWER_IMAGE_SETTINGS,
            VIEWER_SET_SYNC_GROUP,
            REGIONS_HISTORY_ENTRY,
            REGIONS_HISTORY_ACTION,
            REGIONS_COPY_SHAPES,
            HISTOGRAM_RANGE_UPDATE,
            THUMBNAILS_UPDATE,
            SAVE_ACTIVE_IMAGE_SETTINGS
        ].forEach(event =>
            this.context.eventbus.subscribe(
                event,
                params => {
                    iframeTarget.postMessage({
                        context: messageContext,
                        type: 'event',
                        name: event,
                        params,
                    }, '*')
                }
            )
        )
    }
}
