import PopupMessage from '@/components/ui/PopupMessage';
import CircularLoader from '@/components/ui/CircularLoader';
import { useUser } from '@/contexts/UserContext';
import { fetchServiceProviderProfile, updateServiceProviderProfile } from '@/lib/servicesService';
import { ArrowLeft } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { Animated, Keyboard, KeyboardAvoidingView, Platform, ScrollView, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface EditWorkProfileProps {
  onClose?: () => void;
  onSaved?: () => void;
}

export default function EditWorkProfile({ onClose, onSaved }: EditWorkProfileProps) {
  const { currentUser } = useUser();
  const insets = useSafeAreaInsets();
  const scrollRef = React.useRef<ScrollView>(null);
  const popupShift = React.useRef(new Animated.Value(0)).current;
  const [businessName, setBusinessName] = useState('');
  const [bio, setBio] = useState('');
  const [email, setEmail] = useState('');
  const [contact, setContact] = useState('');
  const [emailActive, setEmailActive] = useState(false);
  const [contactActive, setContactActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [popup, setPopup] = useState<{ visible: boolean; type: 'success' | 'error'; title: string; message: string }>({
    visible: false, type: 'success', title: '', message: '',
  });

  useEffect(() => {
    if (!currentUser?.id) return;
    fetchServiceProviderProfile(currentUser.id).then((data) => {
      if (data) {
        setBusinessName(data.name || '');
        setBio(data.master_bio || '');
        setEmail(data.email || '');
        setContact(data.contact || '');
        setEmailActive(data.email_active || false);
        setContactActive(data.contact_active || false);
      }
    }).catch(() => {});
  }, [currentUser?.id]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, () => {
      Animated.timing(popupShift, {
        toValue: -80,
        duration: 220,
        useNativeDriver: true,
      }).start();
    });

    const hideSub = Keyboard.addListener(hideEvent, () => {
      Animated.timing(popupShift, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }).start();
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [popupShift]);

  const showPopup = (type: 'success' | 'error', title: string, message: string) => {
    setPopup({ visible: true, type, title, message });
    setTimeout(() => setPopup(p => ({ ...p, visible: false })), 2500);
  };

  const handleSave = async () => {
    if (!currentUser?.id) return;
    setLoading(true);
    try {
      const trimmedEmail = email.trim();
      const trimmedContact = contact.trim();

      await updateServiceProviderProfile(currentUser.id, {
        name: businessName.trim(),
        master_bio: bio.trim(),
        email: trimmedEmail || null,
        contact: trimmedContact || null,
        email_active: trimmedEmail ? emailActive : false,
        contact_active: trimmedContact ? contactActive : false,
      });
      showPopup('success', 'Profile Updated', 'Work profile saved successfully.');
      onSaved?.();
      setTimeout(() => onClose?.(), 1500);
    } catch {
      showPopup('error', 'Update Failed', 'Failed to save. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const scrollContactIntoView = () => {
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 120);
  };

  return (
    <Animated.View
      className="flex-1 bg-white"
      style={{
        paddingBottom: insets.bottom,
        transform: [{ translateY: popupShift }],
      }}
    >
      <KeyboardAvoidingView
        className="flex-1 bg-white"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 24}
      >
      <PopupMessage
        visible={popup.visible}
        type={popup.type}
        title={popup.title}
        message={popup.message}
        onHide={() => setPopup(p => ({ ...p, visible: false }))}
      />

      {/* Header */}
      <View className="flex-row items-center px-4 pb-4 pt-2">
        <TouchableOpacity onPress={onClose} className="mr-3 p-1">
          <ArrowLeft size={24} color="#000" />
        </TouchableOpacity>
        <Text className="text-lg font-semibold text-gray-900">Edit Work Profile</Text>
      </View>

      <ScrollView
        ref={scrollRef}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 10 }}
      >
        <View className="mb-4">
          <Text className="text-sm font-msemibold text-gray-700 mb-2">Business Name</Text>
          <TextInput
            style={{ borderRadius: 12, borderCurve: "continuous" }}
            className="bg-gray-50 px-4 py-3 text-base text-gray-900 border border-gray-200"
            placeholder="Enter business name"
            placeholderTextColor="#9CA3AF"
            value={businessName}
            onChangeText={setBusinessName}
          />
        </View>

        <View className="mb-4">
          <Text className="text-sm font-msemibold text-gray-700 mb-2">Business Bio</Text>
          <TextInput
            className="bg-gray-50 px-4 py-3 text-base text-gray-900 border border-gray-200"
            placeholder="Tell us about your business"
            placeholderTextColor="#9CA3AF"
            value={bio}
            onChangeText={setBio}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            style={{ minHeight: 100, borderRadius: 12, borderCurve: "continuous" }}
          />
        </View>

        <View className="mb-4">
          <Text className="text-sm font-msemibold text-gray-700 mb-2">Work Email</Text>
          <TextInput
            style={{ borderRadius: 12, borderCurve: "continuous" }}
            className="bg-gray-50 px-4 py-3 text-base text-gray-900 border border-gray-200"
            placeholder="Enter work email"
            placeholderTextColor="#9CA3AF"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <View
            style={{ borderRadius: 12, borderCurve: "continuous" }} className="flex-row items-center justify-between mt-3 bg-gray-50 border border-gray-200 px-4 py-3">
            <View className="flex-1 pr-4">
              <Text className="text-sm font-msemibold text-gray-800">Show Email</Text>
              <Text className="text-xs text-gray-500 mt-0.5">
                Make your work email active on the public work profile
              </Text>
            </View>
            <Switch
              value={emailActive}
              onValueChange={setEmailActive}
              disabled={!email.trim()}
              trackColor={{ false: "#D1D5DB", true: "#10B981" }}
              thumbColor={emailActive ? "#059669" : "#F3F4F6"}
              ios_backgroundColor="#D1D5DB"
            />
          </View>
        </View>

        <View className="mb-4">
          <Text className="text-sm font-msemibold text-gray-700 mb-2">Contact Number</Text>
          <TextInput
            style={{ borderRadius: 12, borderCurve: "continuous" }}
            className="bg-gray-50 px-4 py-3 text-base text-gray-900 border border-gray-200"
            placeholder="Enter contact number"
            placeholderTextColor="#9CA3AF"
            value={contact}
            onChangeText={setContact}
            keyboardType="phone-pad"
            onFocus={scrollContactIntoView}
          />
          <View
            style={{ borderRadius: 12, borderCurve: "continuous" }} className="flex-row items-center justify-between mt-3 bg-gray-50 border border-gray-200 px-4 py-3">
            <View className="flex-1 pr-4">
              <Text className="text-sm font-msemibold text-gray-800">Show Contact Number</Text>
              <Text className="text-xs text-gray-500 mt-0.5">
                Make your work contact number active on the public work profile
              </Text>
            </View>
            <Switch
              value={contactActive}
              onValueChange={setContactActive}
              disabled={!contact.trim()}
              trackColor={{ false: "#D1D5DB", true: "#10B981" }}
              thumbColor={contactActive ? "#059669" : "#F3F4F6"}
              ios_backgroundColor="#D1D5DB"
            />
          </View>
        </View>

        <TouchableOpacity
          style={{ borderRadius: 12, borderCurve: "continuous" }}
          onPress={handleSave}
          disabled={loading}
          className="bg-primary py-4 items-center mt-2"
        >
          {loading ? (
            <CircularLoader color="#fff" />
          ) : (
            <Text className="text-white font-semibold text-base">Save Changes</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
      </KeyboardAvoidingView>
    </Animated.View>
  );
}
