import { createNativeStackNavigator } from "@react-navigation/native-stack";
import UploadScreen from "./src/screens/UploadScreen";
import FeedScreen from "./src/screens/FeedScreen";
import SubscriptionScreen from "./src/screens/SubscriptionScreen";
import ScoreSummaryScreen from "./src/screens/ScoreSummaryScreen";

//create a stack that lets you move in between multiple screens 
const Stack = createNativeStackNavigator();

//define which screens users can navigate between after they have successfully logged in
export default function AppNavigator() {
  return (
    //define the screens that users can navigate between 
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Upload" component={UploadScreen} />
        <Stack.Screen name="Feed" component={FeedScreen} />
        <Stack.Screen name="Subscription" component={SubscriptionScreen} />
        <Stack.Screen name="ScoreSummary" component={ScoreSummaryScreen} />
      </Stack.Navigator>
  );
}
