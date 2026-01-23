/**
 * Example: How to integrate BookMongooseModal in your app
 * 
 * This example shows how to add a "Book Mongoose" button in your UI
 * and display the booking modal.
 */

import BookMongooseModal from '@/components/BookMongooseModal';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

export default function ExampleIntegration() {
  const [showBookingModal, setShowBookingModal] = useState(false);

  return (
    <View className="p-4">
      {/* Example: Featured Provider Card */}
      <View className="bg-white rounded-lg p-4 shadow-sm">
        <View className="flex-row items-center mb-3">
          <View className="bg-green-100 p-3 rounded-full">
            <Ionicons name="person" size={24} color="#10b981" />
          </View>
          <View className="ml-3 flex-1">
            <Text className="text-lg font-bold text-gray-900">Mongoose</Text>
            <Text className="text-sm text-gray-600">Professional Service Provider</Text>
          </View>
        </View>

        {/* Book Now Button */}
        <Pressable
          onPress={() => setShowBookingModal(true)}
          className="bg-green-600 py-3 rounded-lg items-center"
        >
          <Text className="text-white font-semibold">Book Now</Text>
        </Pressable>
      </View>

      {/* Booking Modal */}
      <BookMongooseModal
        visible={showBookingModal}
        onClose={() => setShowBookingModal(false)}
      />
    </View>
  );
}

/**
 * Alternative: Add to Service Detail Page
 */
export function ServiceDetailIntegration() {
  const [showBookingModal, setShowBookingModal] = useState(false);

  return (
    <View>
      {/* Your existing service detail content */}
      
      {/* Footer with Book Button */}
      <View className="absolute bottom-0 left-0 right-0 bg-white p-4 border-t border-gray-200">
        <Pressable
          onPress={() => setShowBookingModal(true)}
          className="bg-green-600 py-4 rounded-lg items-center flex-row justify-center"
        >
          <Ionicons name="calendar" size={20} color="white" />
          <Text className="text-white font-semibold text-base ml-2">
            Book Mongoose
          </Text>
        </Pressable>
      </View>

      <BookMongooseModal
        visible={showBookingModal}
        onClose={() => setShowBookingModal(false)}
      />
    </View>
  );
}

/**
 * Alternative: Add to Provider List
 */
export function ProviderListIntegration() {
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);

  const providers = [
    { id: 'mongoose', name: 'Mongoose', email: 'mongoose@gmail.com' },
    // ... other providers
  ];

  return (
    <View>
      {providers.map((provider) => (
        <View key={provider.id} className="bg-white p-4 mb-2 rounded-lg">
          <Text className="text-lg font-semibold">{provider.name}</Text>
          {provider.email === 'mongoose@gmail.com' && (
            <Pressable
              onPress={() => setSelectedProvider(provider.id)}
              className="mt-2 bg-green-600 py-2 px-4 rounded"
            >
              <Text className="text-white text-center">Book</Text>
            </Pressable>
          )}
        </View>
      ))}

      <BookMongooseModal
        visible={selectedProvider === 'mongoose'}
        onClose={() => setSelectedProvider(null)}
      />
    </View>
  );
}
