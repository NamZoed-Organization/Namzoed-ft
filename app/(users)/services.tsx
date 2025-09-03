// Path: app/(tabs)/services.tsx

import TopNavbar from "@/components/ui/TopNavbar";
import { serviceCategories } from "@/data/servicecategory";
import { router } from "expo-router";
import { FlatList, Text, TouchableOpacity, View } from "react-native";
import { 
  Car, 
  Home, 
  Building2, 
  Sparkles, 
  Wrench, 
  GraduationCap, 
  Palette, 
  Briefcase, 
  MapPin, 
  Heart, 
  Activity, 
  Calendar, 
  Shield, 
  Plane 
} from "lucide-react-native";

export default function ServiceScreen() {
  const handleCategoryPress = (category: any) => {
    router.push(`/(users)/servicedetail/${category.slug}`);
  };

  const getIconComponent = (iconName: string) => {
    const iconMap = {
      'taxi': Car,
      'home': Home,
      'hotel': Building2,
      'spa': Sparkles,
      'tools': Wrench,
      'graduation-cap': GraduationCap,
      'palette': Palette,
      'briefcase': Briefcase,
      'map-pin': MapPin,
      'heart': Heart,
      'activity': Activity,
      'calendar': Calendar,
      'shield': Shield,
      'plane': Plane,
    };
    
    const IconComponent = iconMap[iconName] || Home;
    return <IconComponent size={32} color="black" />;
  };

  const renderCategoryItem = ({ item, index }: { item: any, index: number }) => (
    <TouchableOpacity
      className="bg-white rounded-xl shadow-sm border border-gray-100 items-center justify-center mb-6"
      style={{ 
        width: 100, 
        height: 100,
        marginLeft: index % 3 === 0 ? 0 : 20,
        marginRight: index % 3 === 2 ? 0 : 0
      }}
      onPress={() => handleCategoryPress(item)}
      activeOpacity={0.7}
    >
      <View className="items-center justify-center mb-2">
        {getIconComponent(item.icon)}
      </View>
      <Text className="text-xs font-medium text-gray-900 text-center px-1" numberOfLines={2}>
        {item.name}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View className="flex-1 bg-background">
      <TopNavbar />

      <View className="flex-1 px-4 pt-4">
        {/* Header */}
        <View className="mb-6">
          <Text className="text-2xl font-mbold text-primary mb-2">
            Services
          </Text>
          <Text className="text-base font-regular text-gray-500">
            Choose from our wide range of professional services
          </Text>
        </View>

        {/* Service Categories Grid */}
        <FlatList
          data={serviceCategories}
          renderItem={renderCategoryItem}
          keyExtractor={(item) => item.id}
          numColumns={3}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ 
            paddingBottom: 30,
            paddingTop: 20,
            paddingHorizontal: 16
          }}
          columnWrapperStyle={{ 
            justifyContent: 'flex-start',
            alignItems: 'flex-start',
            flexDirection: 'row'
          }}
          key={3} // Force re-render to maintain 3 columns
        />
      </View>
    </View>
  );
}
