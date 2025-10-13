import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import UploadScreen from "./src/screens/UploadScreen";
import FeedScreen from "./src/screens/FeedScreen";
import SubscriptionScreen from "./src/screens/SubscriptionScreen";

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Upload" component={UploadScreen} />
        <Stack.Screen name="Feed" component={FeedScreen} />
        <Stack.Screen name="Subscription" component={SubscriptionScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
