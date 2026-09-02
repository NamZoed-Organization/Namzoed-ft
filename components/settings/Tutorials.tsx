/**
 * Tutorials – Settings Panel
 *
 * Accessible from Profile → Settings → "Tutorials".
 * Shows two tutorial cards the user can replay at any time:
 *   1. How to Add Products
 *   2. How to Tag People & Products in Posts
 */

import OnboardingTutorial from '@/components/onboarding/OnboardingTutorial';
import type { TutorialId } from '@/hooks/useOnboardingTutorial';
import { useOnboardingTutorial } from '@/hooks/useOnboardingTutorial';
import { ArrowLeft, CheckCircle2, Package, PlayCircle, ShoppingBag, Tag } from 'lucide-react-native';
import React, { useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';

interface TutorialsProps {
  onClose?: () => void;
}

// ─── Card data ────────────────────────────────────────────────────────────────

const TUTORIAL_CARDS = [
  {
    id: 'addProducts' as TutorialId,
    icon: ShoppingBag,
    secondaryIcon: Package,
    accentColor: '#094569',
    title: 'How to Add Products',
    subtitle: 'List & sell on your profile',
    description:
      'Learn how to create product listings on your profile so customers can discover and buy from you.',
    steps: ['Go to your Profile', 'Open the Products tab', 'Tap "+ Add Product"', 'Fill in details & post'],
  },
  {
    id: 'tagInPosts' as TutorialId,
    icon: Tag,
    secondaryIcon: ShoppingBag,
    accentColor: '#0369a1',
    title: 'Tag in Feed Posts',
    subtitle: 'Link products & mention people',
    description:
      'Discover how to link your product listings and mention other users directly inside your feed posts.',
    steps: ['Open Post Creator', 'Tap "Tag Products"', 'Tap "Tag People"', 'Share your post'],
  },
] as const;

// ─── Component ────────────────────────────────────────────────────────────────

export default function Tutorials({ onClose }: TutorialsProps) {
  const { state: tutorialState, markComplete } = useOnboardingTutorial();

  const [activeTutorial, setActiveTutorial] = useState<TutorialId | null>(null);

  const handleViewTutorial = (id: TutorialId) => {
    setActiveTutorial(id);
  };

  const handleTutorialDone = async () => {
    if (activeTutorial) {
      await markComplete(activeTutorial);
    }
    setActiveTutorial(null);
  };

  return (
    <View className="flex-1 bg-white">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <View className="flex-row items-center p-4 border-b border-gray-100">
        <TouchableOpacity onPress={onClose} className="mr-3 p-1" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <ArrowLeft size={24} color="#111827" />
        </TouchableOpacity>
        <View>
          <Text className="text-lg font-semibold text-gray-900">Tutorials</Text>
          <Text className="text-xs text-gray-400 mt-0.5">Learn how to use Namzoed's features</Text>
        </View>
      </View>

      {/* ── Content ─────────────────────────────────────────────────────── */}
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 20, paddingBottom: 40 }}
      >
        {/* Intro blurb */}
        <Text className="text-sm text-gray-500 mb-6 leading-5">
          Step-by-step walkthroughs to help you get the most out of Namzoed. Tap any tutorial to replay it.
        </Text>

        {/* Tutorial cards */}
        {TUTORIAL_CARDS.map((card) => {
          const Icon = card.icon;
          const isDone = tutorialState[card.id];

          return (
            <View
              key={card.id}
              className="mb-4 bg-white overflow-hidden border border-gray-100"
              style={{ shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.06,
                shadowRadius: 8,
                elevation: 3, borderRadius: 16, borderCurve: "continuous" }}
            >
              {/* Card header strip */}
              <View
                className="px-4 py-3 flex-row items-center justify-between"
                style={{ backgroundColor: card.accentColor }}
              >
                <View className="flex-row items-center gap-2">
                  <View
                    style={{
                      backgroundColor: 'rgba(255,255,255,0.2)',
                      borderRadius: 10,
                      borderCurve: "continuous",
                      padding: 6,
                    }}
                  >
                    <Icon size={20} color="#fff" strokeWidth={1.8} />
                  </View>
                  <View>
                    <Text className="text-white font-semibold text-sm">{card.title}</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11 }}>{card.subtitle}</Text>
                  </View>
                </View>

                {/* Completion badge */}
                {isDone && (
                  <View
                    style={{
                      backgroundColor: 'rgba(255,255,255,0.25)',
                      borderRadius: 12,
                      borderCurve: "continuous",
                      paddingHorizontal: 8,
                      paddingVertical: 3,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <CheckCircle2 size={12} color="#fff" />
                    <Text style={{ color: '#fff', fontSize: 11, fontWeight: '600' }}>Done</Text>
                  </View>
                )}
              </View>

              {/* Card body */}
              <View className="px-4 pt-3 pb-4">
                <Text className="text-gray-600 text-sm leading-5 mb-3">{card.description}</Text>

                {/* Mini step previews */}
                <View className="flex-row flex-wrap gap-2 mb-4">
                  {card.steps.map((step, idx) => (
                    <View
                      key={idx}
                      className="flex-row items-center gap-1 px-2 py-1 rounded-full"
                      style={{ backgroundColor: `${card.accentColor}14` }}
                    >
                      <Text
                        style={{
                          color: card.accentColor,
                          fontSize: 10,
                          fontWeight: '700',
                          minWidth: 14,
                          textAlign: 'center',
                        }}
                      >
                        {idx + 1}
                      </Text>
                      <Text style={{ color: card.accentColor, fontSize: 11, fontWeight: '500' }}>{step}</Text>
                    </View>
                  ))}
                </View>

                {/* CTA button */}
                <TouchableOpacity
                  onPress={() => handleViewTutorial(card.id)}
                  activeOpacity={0.8}
                  className="flex-row items-center justify-center gap-2 py-3"
                  style={{ backgroundColor: card.accentColor, borderRadius: 12, borderCurve: "continuous" }}
                >
                  <PlayCircle size={16} color="#fff" />
                  <Text className="text-white font-semibold text-sm">
                    {isDone ? 'Replay Tutorial' : 'View Tutorial'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}

        {/* Footer note */}
        <Text className="text-xs text-gray-400 text-center mt-2 leading-4">
          These tutorials walk you through the core features step by step.{'\n'}You can come back here and replay them anytime.
        </Text>
      </ScrollView>

      {/* ── Tutorial Modal ──────────────────────────────────────────────── */}
      {activeTutorial !== null && (
        <OnboardingTutorial
          visible={activeTutorial !== null}
          mode={activeTutorial}
          onComplete={handleTutorialDone}
          onDismiss={handleTutorialDone}
        />
      )}
    </View>
  );
}
