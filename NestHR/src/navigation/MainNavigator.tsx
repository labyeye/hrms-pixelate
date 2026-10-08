import React from 'react';
import {
  createBottomTabNavigator,
  BottomTabBarProps,
} from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  LayoutChangeEvent,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Home, Users, Clock, Calendar, Grid, LucideIcon } from 'lucide-react-native';
import { C } from '../theme';
import { useAuth } from '../contexts/AuthContext';
import TabBounce from '../components/motion/TabBounce';
import DashboardScreen from '../screens/DashboardScreen';
import EmployeesScreen from '../screens/EmployeesScreen';
import AttendanceScreen from '../screens/AttendanceScreen';
import LeaveScreen from '../screens/LeaveScreen';
import MoreScreen from '../screens/MoreScreen';
import PayrollScreen from '../screens/PayrollScreen';
import RecruitmentScreen from '../screens/RecruitmentScreen';
import PerformanceScreen from '../screens/PerformanceScreen';
import PerformanceReportScreen from '../screens/PerformanceReportScreen';
import DepartmentsScreen from '../screens/DepartmentsScreen';
import HolidaysScreen from '../screens/HolidaysScreen';
import LoansScreen from '../screens/LoansScreen';
import ReportsScreen from '../screens/ReportsScreen';
import SettingsScreen from '../screens/SettingsScreen';
import BillingScreen from '../screens/BillingScreen';
import CredentialsScreen from '../screens/CredentialsScreen';
import ManageScreen from '../screens/ManageScreen';
import ShiftsScreen from '../screens/ShiftsScreen';
import SalaryHeadsScreen from '../screens/SalaryHeadsScreen';
import DesignationsScreen from '../screens/DesignationsScreen';
import OfferLettersScreen from '../screens/OfferLettersScreen';
import ProfileScreen from '../screens/ProfileScreen';
import BiometricDeviceScreen from '../screens/BiometricDeviceScreen';
import NfcManagerScreen from '../screens/NfcManagerScreen';
import AttendanceSettingsScreen from '../screens/AttendanceSettingsScreen';
import LateApprovalsScreen from '../screens/LateApprovalsScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import AuditLogScreen from '../screens/AuditLogScreen';
import SupportScreen from '../screens/SupportScreen';
import DocumentsScreen from '../screens/DocumentsScreen';
import ExitManagementScreen from '../screens/ExitManagementScreen';
import AssetsScreen from '../screens/AssetsScreen';
import TasksScreen from '../screens/TasksScreen';
import AnnouncementsScreen from '../screens/AnnouncementsScreen';
import TrashScreen from '../screens/TrashScreen';

const Tab = createBottomTabNavigator();
const MoreStack = createNativeStackNavigator();

function MoreNavigator() {
  return (
    <MoreStack.Navigator screenOptions={{ headerShown: false }}>
      <MoreStack.Screen name="MoreHome" component={MoreScreen} />
      <MoreStack.Screen name="Payroll" component={PayrollScreen} />
      <MoreStack.Screen name="Recruitment" component={RecruitmentScreen} />
      <MoreStack.Screen name="Performance" component={PerformanceScreen} />
      <MoreStack.Screen
        name="PerformanceReport"
        component={PerformanceReportScreen}
      />
      <MoreStack.Screen name="Departments" component={DepartmentsScreen} />
      <MoreStack.Screen name="Holidays" component={HolidaysScreen} />
      <MoreStack.Screen name="Loans" component={LoansScreen} />
      <MoreStack.Screen name="Reports" component={ReportsScreen} />
      <MoreStack.Screen name="Settings" component={SettingsScreen} />
      <MoreStack.Screen name="Billing" component={BillingScreen} />
      <MoreStack.Screen name="Credentials" component={CredentialsScreen} />
      <MoreStack.Screen name="Manage" component={ManageScreen} />
      <MoreStack.Screen name="Shifts" component={ShiftsScreen} />
      <MoreStack.Screen name="SalaryHeads" component={SalaryHeadsScreen} />
      <MoreStack.Screen name="Designations" component={DesignationsScreen} />
      <MoreStack.Screen name="OfferLetters" component={OfferLettersScreen} />
      <MoreStack.Screen name="Profile" component={ProfileScreen} />
      <MoreStack.Screen
        name="BiometricDevices"
        component={BiometricDeviceScreen}
      />
      <MoreStack.Screen name="NfcManager" component={NfcManagerScreen} />
      <MoreStack.Screen
        name="AttendanceSettings"
        component={AttendanceSettingsScreen}
      />
      <MoreStack.Screen name="LateApprovals" component={LateApprovalsScreen} />
      <MoreStack.Screen name="Notifications" component={NotificationsScreen} />
      <MoreStack.Screen name="AuditLog" component={AuditLogScreen} />
      <MoreStack.Screen name="Support" component={SupportScreen} />
      <MoreStack.Screen name="Documents" component={DocumentsScreen} />
      <MoreStack.Screen name="Assets" component={AssetsScreen} />
      <MoreStack.Screen name="Tasks" component={TasksScreen} />
      <MoreStack.Screen name="Announcements" component={AnnouncementsScreen} />
      <MoreStack.Screen name="Trash" component={TrashScreen} />
      <MoreStack.Screen
        name="ExitManagement"
        component={ExitManagementScreen}
      />
    </MoreStack.Navigator>
  );
}

const TAB_ICONS: Record<string, LucideIcon> = {
  Home: Home,
  Employees: Users,
  Attendance: Clock,
  Leave: Calendar,
  More: Grid,
};

const BAR_ROW = 60;
const FAB = 64;
const NOTCH_W = 60;
const NOTCH_DEPTH = 40;

// Bottom bar with Attendance raised in the middle, sitting in a curved
// notch — same shape/behavior as NestLeads' tab bar, re-themed to NestHR.
// Home + Employees sit to the left, Leave + More to the right.
function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const [width, setWidth] = React.useState(0);
  const height = BAR_ROW + insets.bottom;
  const centerIndex = Math.floor(state.routes.length / 2);
  const hasCenter =
    state.routes.length === 5 &&
    state.routes[centerIndex].name === 'Attendance';
  const cx = width / 2;
  const path = hasCenter
    ? `M-2,0 L${cx - NOTCH_W},0 C${cx - NOTCH_W + 22},0 ${
        cx - 36
      },${NOTCH_DEPTH} ${cx},${NOTCH_DEPTH} C${cx + 36},${NOTCH_DEPTH} ${
        cx + NOTCH_W - 22
      },0 ${cx + NOTCH_W},0 L${width + 2},0 L${width + 2},${height + 2} L-2,${
        height + 2
      } Z`
    : `M-2,0 L${width + 2},0 L${width + 2},${height + 2} L-2,${height + 2} Z`;

  return (
    <View
      style={[styles.barWrap, { height }]}
      onLayout={(e: LayoutChangeEvent) =>
        setWidth(Math.floor(e.nativeEvent.layout.width))
      }
    >
      {width > 0 && (
        <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
          <Path
            d={path}
            fill={C.white}
            stroke={C.black}
            strokeWidth={2}
            strokeLinejoin="round"
          />
        </Svg>
      )}
      <View style={[styles.barRow, { paddingBottom: insets.bottom }]}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const focused = state.index === index;
          const raised = hasCenter && index === centerIndex;
          const color = focused ? C.primary : '#9CA3AF';
          const Icon = TAB_ICONS[route.name] || Home;
          const label =
            typeof options.tabBarLabel === 'string'
              ? options.tabBarLabel
              : options.title ?? route.name;
          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name as never);
            }
          };
          return (
            <TouchableOpacity
              key={route.key}
              accessibilityRole="button"
              accessibilityState={focused ? { selected: true } : {}}
              onPress={onPress}
              activeOpacity={0.8}
              style={styles.tabItem}
            >
              {raised ? (
                <>
                  <View style={styles.fab}>
                    <Icon size={28} color={C.white} />
                  </View>
                  <View style={styles.iconWrap} />
                </>
              ) : (
                <TabBounce focused={focused}>
                  <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
                    <Icon size={20} color={color} />
                  </View>
                </TabBounce>
              )}
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                style={[styles.tabLabel, raised && styles.tabLabelRaised, { color }]}
              >
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export default function MainNavigator() {
  const { user } = useAuth();
  const isEmployee = user?.role === 'employee';

  return (
    <Tab.Navigator
      tabBar={props => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen
        name="Home"
        component={DashboardScreen}
        options={{ tabBarLabel: 'Home' }}
      />
      {!isEmployee && (
        <Tab.Screen
          name="Employees"
          component={EmployeesScreen}
          options={{ tabBarLabel: 'Employee' }}
        />
      )}
      <Tab.Screen
        name="Attendance"
        component={AttendanceScreen}
        options={{ tabBarLabel: 'Attend' }}
      />
      <Tab.Screen
        name="Leave"
        component={LeaveScreen}
        options={{ tabBarLabel: 'Leave' }}
      />
      <Tab.Screen
        name="More"
        component={MoreNavigator}
        options={{ tabBarLabel: 'More' }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  barWrap: { backgroundColor: 'transparent' },
  barRow: { flexDirection: 'row', flex: 1, paddingTop: 4 },
  tabItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  fab: {
    position: 'absolute',
    top: -(FAB / 2) - 2,
    width: FAB,
    height: FAB,
    borderRadius: FAB / 2,
    borderWidth: 2,
    borderColor: C.black,
    backgroundColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    maxWidth: '100%',
  },
  tabLabelRaised: { marginTop: 5 },
  iconWrap: {
    width: 32,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: {},
});
