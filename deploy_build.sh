#!/bin/bash

#copy over html,css,js and templates
echo "Deploying built resources to plugin directory..."
cp src/index.html plugin/omero_iviewer/templates/omero_iviewer_clovid
cp -r build/css/* plugin/omero_iviewer/static/omero_iviewer_clovid/css
cp build/*.js* plugin/omero_iviewer/static/omero_iviewer_clovid/
cp src/openwith.js plugin/omero_iviewer/static/omero_iviewer_clovid/
