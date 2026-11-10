import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  FlatList,
  Pressable,
  Image,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { CarouselBannerItem } from '../../types';
import { useApp } from '../../context/app-context';
import { Spacing } from '../../constants/theme';
import { AppIcon } from './AppIcon';
import { resolveImageUrl } from '../../services/api';
import { getOptimizedImageSource } from '../../services/image-assets';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = Math.min(SCREEN_WIDTH - Spacing.four * 2, 480);

export interface HomeCarouselProps {
  banners: CarouselBannerItem[];
  onPressBanner?: (banner: CarouselBannerItem) => void;
}

export function HomeCarousel({ banners, onPressBanner }: HomeCarouselProps) {
  const { lang, colors, isDark } = useApp();
  const [activeIndex, setActiveIndex] = useState(0);
  const activeIndexRef = useRef(0);
  const flatListRef = useRef<FlatList>(null);
  const autoplayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDraggingRef = useRef(false);

  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  const scheduleAutoplay = useCallback((delayMs = 4500) => {
    if (autoplayTimerRef.current) {
      clearTimeout(autoplayTimerRef.current);
      autoplayTimerRef.current = null;
    }
    if (!banners || banners.length <= 1) return;

    autoplayTimerRef.current = setTimeout(() => {
      if (isDraggingRef.current) return;
      const nextIndex = (activeIndexRef.current + 1) % banners.length;
      flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
      setActiveIndex(nextIndex);
      activeIndexRef.current = nextIndex;
      scheduleAutoplay(4500);
    }, delayMs);
  }, [banners]);

  // Start autoplay on mount and cleanup on unmount
  useEffect(() => {
    scheduleAutoplay(4500);
    return () => {
      if (autoplayTimerRef.current) {
        clearTimeout(autoplayTimerRef.current);
        autoplayTimerRef.current = null;
      }
    };
  }, [scheduleAutoplay]);

  const handleScrollBeginDrag = () => {
    isDraggingRef.current = true;
    if (autoplayTimerRef.current) {
      clearTimeout(autoplayTimerRef.current);
      autoplayTimerRef.current = null;
    }
  };

  const handleScrollEndDrag = () => {
    isDraggingRef.current = false;
    scheduleAutoplay(4500);
  };

  const handleMomentumScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    isDraggingRef.current = false;
    const slideSize = CARD_WIDTH + Spacing.three;
    const index = Math.round(event.nativeEvent.contentOffset.x / slideSize);
    if (index >= 0 && index < banners.length) {
      setActiveIndex(index);
      activeIndexRef.current = index;
    }
    scheduleAutoplay(4500);
  };

  const handleManualShift = (direction: 'next' | 'prev') => {
    if (!banners || banners.length <= 1) return;
    const targetIdx =
      direction === 'next'
        ? (activeIndex + 1) % banners.length
        : (activeIndex - 1 + banners.length) % banners.length;

    flatListRef.current?.scrollToIndex({ index: targetIdx, animated: true });
    setActiveIndex(targetIdx);
    activeIndexRef.current = targetIdx;
    scheduleAutoplay(4500);
  };

  if (!banners || banners.length === 0) {
    return null;
  }

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const slideSize = CARD_WIDTH + Spacing.three;
    const index = Math.round(event.nativeEvent.contentOffset.x / slideSize);
    if (index !== activeIndex && index >= 0 && index < banners.length) {
      setActiveIndex(index);
      activeIndexRef.current = index;
    }
  };

  const renderBannerItem = ({ item }: { item: CarouselBannerItem }) => {
    const resolvedUri = resolveImageUrl(item.imageUrl);
    const imageSource = getOptimizedImageSource(item.imageUrl, resolvedUri);

    return (
      <Pressable
        onPress={() => onPressBanner?.(item)}
        style={({ pressed }) => [
          styles.bannerCard,
          {
            backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
            borderColor: colors.border,
            width: CARD_WIDTH,
          },
          pressed && { opacity: 0.93 },
        ]}
      >
        {/* Banner Media */}
        <View style={styles.imageWrapper}>
          {imageSource ? (
            <Image
              source={imageSource}
              alt={item.title}
              style={styles.bannerImage}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.placeholderImage, { backgroundColor: colors.secondary }]}>
              <AppIcon
                name={{ ios: 'sparkles', android: 'auto_awesome', web: 'sparkles' }}
                size={32}
                color={colors.primary}
              />
            </View>
          )}

          {/* Dark Overlay for contrast */}
          <View style={styles.gradientOverlay} />

          {/* Top Badge: Pushkaralu 2027 */}
          <View style={styles.topBadge}>
            <AppIcon
              name={{ ios: 'sparkles', android: 'auto_awesome', web: 'sparkles' }}
              size={11}
              color="#FDE047"
            />
            <Text style={styles.topBadgeText}>Pushkaralu 2027</Text>
          </View>

          {/* Bottom Content overlaid on image */}
          <View style={styles.overlayContent}>
            <Text style={styles.bannerTitle} numberOfLines={1}>
              {item.title}
            </Text>
            {item.subtitle ? (
              <Text style={styles.bannerSubtitle} numberOfLines={1}>
                {item.subtitle}
              </Text>
            ) : null}
            {item.description ? (
              <Text style={styles.bannerDescription} numberOfLines={2}>
                {item.description}
              </Text>
            ) : null}

            {/* CTA row */}
            <View style={styles.ctaRow}>
              <View style={styles.ctaPill}>
                <Text style={styles.ctaText}>
                  {item.ctaLabel || (lang === 'te' ? 'పూర్తి వివరాలు' : 'Learn More')}
                </Text>
                <AppIcon
                  name={{ ios: 'arrow.right', android: 'arrow_forward', web: 'arrow-right' }}
                  size={12}
                  color="#FFFFFF"
                />
              </View>
            </View>
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      {/* Section Header */}
      <View style={styles.headerRow}>
        <View style={styles.badgeWrapper}>
          <View
            style={[
              styles.sectionBadge,
              {
                backgroundColor: isDark ? 'rgba(85, 189, 181, 0.15)' : 'rgba(22, 138, 138, 0.1)',
                borderColor: isDark ? 'rgba(85, 189, 181, 0.3)' : 'rgba(22, 138, 138, 0.2)',
              },
            ]}
          >
            <AppIcon
              name={{ ios: 'sparkles', android: 'auto_awesome', web: 'sparkles' }}
              size={12}
              color={colors.primary}
            />
            <Text style={[styles.sectionBadgeText, { color: colors.primary }]}>
              {lang === 'te' ? 'ప్రత్యేక ముఖ్యాంశాలు' : 'Featured Highlights'}
            </Text>
          </View>
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
            {lang === 'te' ? 'గోదావరి పుష్కరాలు 2027' : 'Pushkaralu 2027'}
          </Text>
        </View>

        {/* Manual navigation controls */}
        {banners.length > 1 && (
          <View style={styles.navControls}>
            <Pressable
              onPress={() => handleManualShift('prev')}
              accessibilityRole="button"
              accessibilityLabel="Previous slide"
              hitSlop={8}
              style={({ pressed }) => [
                styles.navBtn,
                {
                  borderColor: colors.border,
                  backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
                },
                pressed && { opacity: 0.6 },
              ]}
            >
              <AppIcon
                name={{ ios: 'chevron.left', android: 'chevron_left', web: 'chevron-left' }}
                size={14}
                color={colors.text}
              />
            </Pressable>
            <Pressable
              onPress={() => handleManualShift('next')}
              accessibilityRole="button"
              accessibilityLabel="Next slide"
              hitSlop={8}
              style={({ pressed }) => [
                styles.navBtn,
                {
                  borderColor: colors.border,
                  backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
                },
                pressed && { opacity: 0.6 },
              ]}
            >
              <AppIcon
                name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron-right' }}
                size={14}
                color={colors.text}
              />
            </Pressable>
          </View>
        )}
      </View>

      {/* Sliding Carousel */}
      <FlatList
        ref={flatListRef}
        data={banners}
        keyExtractor={(item) => item.id}
        renderItem={renderBannerItem}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={CARD_WIDTH + Spacing.three}
        snapToAlignment="start"
        decelerationRate="fast"
        nestedScrollEnabled={true}
        contentContainerStyle={styles.carouselList}
        onScroll={onScroll}
        onScrollBeginDrag={handleScrollBeginDrag}
        onScrollEndDrag={handleScrollEndDrag}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        scrollEventThrottle={16}
        onScrollToIndexFailed={(info) => {
          setTimeout(() => {
            flatListRef.current?.scrollToIndex({ index: info.index, animated: true });
          }, 100);
        }}
      />

      {/* Pagination Indicators */}
      {banners.length > 1 && (
        <View style={styles.paginationRow}>
          {banners.map((_, i) => (
            <Pressable
              key={i}
              onPress={() => {
                flatListRef.current?.scrollToIndex({ index: i, animated: true });
                setActiveIndex(i);
                activeIndexRef.current = i;
                scheduleAutoplay(4500);
              }}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`Banner ${i + 1}`}
            >
              <View
                style={[
                  styles.dot,
                  {
                    backgroundColor:
                      i === activeIndex
                        ? colors.primary
                        : isDark
                        ? 'rgba(255,255,255,0.2)'
                        : 'rgba(0,0,0,0.15)',
                    width: i === activeIndex ? 20 : 6,
                  },
                ]}
              />
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.four,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
    marginBottom: Spacing.two,
  },
  badgeWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 14,
    borderWidth: 1,
    gap: 5,
  },
  sectionBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 11,
  },
  navControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  navBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  carouselList: {
    gap: Spacing.three,
    paddingVertical: 2,
  },
  bannerCard: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  imageWrapper: {
    width: '100%',
    aspectRatio: 16 / 9,
    position: 'relative',
    backgroundColor: '#0F172A',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  placeholderImage: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gradientOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.48)',
  },
  topBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    gap: 4,
  },
  topBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  overlayContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: Spacing.three,
    backgroundColor: 'rgba(0,0,0,0.55)',
    gap: 3,
  },
  bannerTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  bannerSubtitle: {
    color: '#99F6E4',
    fontSize: 12,
    fontWeight: '600',
  },
  bannerDescription: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 11,
    lineHeight: 15,
  },
  ctaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  ctaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(22, 138, 138, 0.85)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 5,
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 10.5,
    fontWeight: '700',
  },
  paginationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    marginTop: 10,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
});
