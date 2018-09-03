"""

    Morph from source to destination face or
    Morph through all images in a folder


Source: https://github.com/alyssaq/face_morpher/blob/master/facemorpher/morpher.py
"""

import os
import numpy as np
import cv2
import sys

# Facemorpher-specific imports
from facemorpher import locator
from facemorpher import aligner
from facemorpher import warper
from facemorpher import blender
from facemorpher import plotter
from facemorpher import videoer

# RU-specific imports
from utils import get_error_message, DoError

def load_image_points(path, size):
    img = cv2.imread(path)
    points = locator.face_points(img)

    if len(points) == 0:
        print('No face in %s' % path)
        return None, None
    else:
        return aligner.resize_align(img, points, size)

def load_valid_image_points(imgpaths, size):
    for path in imgpaths:
        img, points = load_image_points(path, size)
        if img is not None:
            print(path)
            yield (img, points)

def list_imgpaths(images_folder=None, src_image=None, dest_image=None):
    if images_folder is None:
        yield src_image
        yield dest_image
    else:
        for fname in os.listdir(images_folder):
            if (fname.lower().endswith('.jpg') or
                 fname.lower().endswith('.png') or
                 fname.lower().endswith('.jpeg')):
                yield os.path.join(images_folder, fname)

def alpha_image(img, points):
    mask = blender.mask_from_points(img.shape[:2], points)
    return np.dstack((img, mask))

def morph(src_img, src_points, dest_img, dest_points,
                    video, width=500, height=600, num_frames=20, fps=10,
                    out_frames=None, out_video=None, alpha=False, plot=False):
    """
    Create a morph sequence from source to destination image
    :param src_img: ndarray source image
    :param src_img: source image array of x,y face points
    :param dest_img: ndarray destination image
    :param dest_img: destination image array of x,y face points
    :param video: facemorpher.videoer.Video object
    """
    size = (height, width)
    stall_frames = np.clip(int(fps*0.15), 1, fps)    # Show first & last longer
    plt = plotter.Plotter(plot, num_images=num_frames, out_folder=out_frames)
    num_frames -= (stall_frames * 2)    # No need to process src and dest image

    plt.plot_one(src_img)
    video.write(src_img, 1)

    # Produce morph frames!
    for percent in np.linspace(1, 0, num=num_frames):
        points = locator.weighted_average_points(src_points, dest_points, percent)
        src_face = warper.warp_image(src_img, src_points, points, size)
        end_face = warper.warp_image(dest_img, dest_points, points, size)
        average_face = blender.weighted_average(src_face, end_face, percent)
        average_face = alpha_image(average_face, points) if alpha else average_face

        plt.plot_one(average_face)
        plt.save(average_face)
        video.write(average_face)

    plt.plot_one(dest_img)
    video.write(dest_img, stall_frames)
    plt.show()

def ru_morpher(imgpaths, width=500, height=600, num_frames=20, fps=10,
                        out_frames=None, out_video=None, alpha=False, plot=False, obj=None):
    """
    Create a morph sequence from multiple images in imgpaths
    :param imgpaths: array or generator of image paths
    :param callback: callback function on each point
    """

    try:
        video = videoer.Video(out_video, fps, width, height)
        images_points_gen = load_valid_image_points(imgpaths, (height, width))
        src_img, src_points = next(images_points_gen)
        iStep = 0
        for dest_img, dest_points in images_points_gen:
            morph(src_img, src_points, dest_img, dest_points, video,
                        width, height, num_frames, fps, out_frames, out_video, alpha, plot)
            # Check for a callback function
            if obj != None:
                print("ru_morpher calls mix_callback {}, {}".format(obj.counter, iStep), file=sys.stdout)
                obj.mix_callback(obj.counter, iStep, dest_img, dest_points)
            else:
                print("ru_morpher has obj=None", file=sys.stdout)
            # Set the new source = old destination
            src_img, src_points = dest_img, dest_points

            iStep += 1
        video.end()
    except:
        sHtml = get_error_message()
        DoError("ru_morpher: ")
