#
# Copyright (c) 2017 University of Dundee.
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as
# published by the Free Software Foundation, either version 3 of the
# License, or (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU Affero General Public License for more details.
#
# You should have received a copy of the GNU Affero General Public License
# along with this program.  If not, see <http://www.gnu.org/licenses/>.
#

from django.conf.urls import url

from omero_iviewer_clovid import views

urlpatterns = [
    # general entry point for iviewer app
    url(r'^$', views.index, name='omero_iviewer_index'),
    url(r'^persist_rois/?$', views.persist_rois,
        name='omero_iviewer_persist_rois'),
    url(r'^image_data/(?P<image_id>[0-9]+)/$', views.image_data,
        name='omero_iviewer_image_data'),
    url(r'^image_data/(?P<image_id>[0-9]+)/delta_t/$', views.delta_t_data,
        name='omero_iviewer_image_data_deltat'),
    # load image_data for image linked to an ROI or Shape
    url(r'^(?P<obj_type>(roi|shape))/(?P<obj_id>[0-9]+)/image_data/$',
        views.roi_image_data, name='omero_iviewer_roi_image_data'),
    url(r'^save_projection/?$', views.save_projection,
        name='omero_iviewer_save_projection'),
    url(r'^well_images/?$', views.well_images,
        name='omero_iviewer_well_images'),
    url(r'^get_intensity/?$', views.get_intensity,
        name='omero_iviewer_get_intensity'),
    url(r'^shape_stats/?$', views.shape_stats,
        name='omero_iviewer_shape_stats'),
    # optional z or t range e.g. iid/0-10/2-5/
    url(r'^rois_by_plane/(?P<image_id>[0-9]+)/'
        r'(?P<the_z>[0-9]+)(?:-(?P<z_end>[0-9]+))?/'
        r'(?P<the_t>[0-9:]+)(?:-(?P<t_end>[0-9]+))?/$',
        views.rois_by_plane, name='omero_iviewer_rois_by_plane'),
    url(r'^plane_shape_counts/(?P<image_id>[0-9]+)/$',
        views.plane_shape_counts, name='omero_iviewer_plane_shape_counts'),
    # Find the index of an ROI within all ROIs for the Image (for pagination)
    url(r'^(?P<obj_type>(roi|shape))/(?P<obj_id>[0-9]+)/page_data/$',
        views.roi_page_data, name='omero_iviewer_roi_page_data'),
]
