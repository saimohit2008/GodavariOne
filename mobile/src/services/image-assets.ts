// Static offline image assets mapping for Godavari One Mobile
// Provides zero-network asset fallbacks matching exact database /uploads/ paths

import { ImageSourcePropType } from 'react-native';

import imgHarathi from '../../assets/uploads/1792830251810-db76cf0ea3a1fa0bd2dfeedc.jpg';
import imgMusical from '../../assets/uploads/1792830307036-11d185f9a85d89f848a4e3c4.jpg';
import imgStatue from '../../assets/uploads/1792288701815-73f89477df61cc5796c9dd18.jpg';
import imgSitara from '../../assets/uploads/1792247602961-4c512f5906936c4ee9bb1167.jpg';
import imgLaHospin from '../../assets/uploads/1792247476428-38ec78ebc75732ee4d89006c.jpg';
import imgPushkarGhat from '../../assets/uploads/1792247407777-61a905ce170f9dbc883db9c5.jpg';
import imgGslHospital from '../../assets/uploads/1792247271345-446bbd4c7009eb42b52db85a.jpg';
import imgMahakaleswara from '../../assets/uploads/1792247158798-9449ca54f9e6738bc8d27a8a.png';
import imgMonsterTours from '../../assets/uploads/1792246721746-ec54b14e4318335e06442adf.png';
import imgVlPuramSchool from '../../assets/uploads/1792246825942-b00ff85ae9c38d66ee53dfbf.png';
import imgMahaPrasadam from '../../assets/uploads/1792246980513-4f6c0bc92e2cedaeea2b1290.png';

const LOCAL_UPLOAD_ASSETS: Record<string, ImageSourcePropType> = {
  '1792830251810-db76cf0ea3a1fa0bd2dfeedc.jpg': imgHarathi,
  '1792830307036-11d185f9a85d89f848a4e3c4.jpg': imgMusical,
  '1792288701815-73f89477df61cc5796c9dd18.jpg': imgStatue,
  '1792247602961-4c512f5906936c4ee9bb1167.jpg': imgSitara,
  '1792247476428-38ec78ebc75732ee4d89006c.jpg': imgLaHospin,
  '1792247407777-61a905ce170f9dbc883db9c5.jpg': imgPushkarGhat,
  '1792247271345-446bbd4c7009eb42b52db85a.jpg': imgGslHospital,
  '1792247158798-9449ca54f9e6738bc8d27a8a.png': imgMahakaleswara,
  '1792246721746-ec54b14e4318335e06442adf.png': imgMonsterTours,
  '1792246825942-b00ff85ae9c38d66ee53dfbf.png': imgVlPuramSchool,
  '1792246980513-4f6c0bc92e2cedaeea2b1290.png': imgMahaPrasadam,
};

/**
 * Returns a static local asset if available, or a remote URI object
 */
export function getOptimizedImageSource(
  imageUrl?: string | null,
  resolvedUri?: string | null
): ImageSourcePropType | null {
  if (!imageUrl && !resolvedUri) return null;

  const targetPath = (imageUrl || resolvedUri || '').trim();
  const filename = targetPath.split('/').pop()?.split('?')[0];

  if (filename && LOCAL_UPLOAD_ASSETS[filename]) {
    return LOCAL_UPLOAD_ASSETS[filename];
  }

  if (resolvedUri) {
    return { uri: resolvedUri };
  }

  if (targetPath.startsWith('http://') || targetPath.startsWith('https://')) {
    return { uri: targetPath };
  }

  return null;
}
