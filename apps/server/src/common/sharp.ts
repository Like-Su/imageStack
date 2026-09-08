import type sharpFactory from 'sharp';
import sharpModule = require('sharp');

export const sharp = sharpModule as unknown as typeof sharpFactory;
