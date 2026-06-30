import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Home, Users, Clock, Calendar, Grid } from 'lucide-react-native';
import { C } from '../theme';
import { useAuth } from '../contexts/AuthContext';
import DashboardScreen from '../screens/DashboardScreen';
import EmployeesScreen from '../screens/EmployeesScreen';
import AttendanceScreen from '../screens/AttendanceScreen';
import LeaveScreen from '../screens/LeaveScreen';
import MoreScreen from '../screens/MoreScreen';
import PayrollScreen from '../screens/PayrollScreen';
import RecruitmentScreen from '../screens/RecruitmentScreen';
import PerformanceScreen from '../screens/PerformanceScreen';
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
import PayrollSettingsScreen from '../screens/PayrollSettingsScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import AuditLogScreen from '../screens/AuditLogScreen';
import SupportScreen from '../screens/SupportScreen';
import DocumentsScreen from '../screens/DocumentsScreen';
import ExitManagementScreen from '../screens/ExitManagementScreen';
import AssetsScreen from '../screens/AssetsScreen';

const Tab = createBottomTabNavigator();
const MoreStack = createNativeStackNavigator();

function MoreNavigator() {
  return (
    <MoreStack.Navigator screenOptions={{ headerShown: false }}>
      <MoreStack.Screen name="MoreHome" component={MoreScreen} />
      <MoreStack.Screen name="Payroll" component={PayrollScreen} />
      <MoreStack.Screen name="Recruitment" component={RecruitmentScreen} />
      <MoreStack.Screen name="Performance" component={PerformanceScreen} />
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
        name="PayrollSettings"
        component={PayrollSettingsScreen}
      />
      <MoreStack.Screen name="Notifications" component={NotificationsScreen} />
      <MoreStack.Screen name="AuditLog" component={AuditLogScreen} />
      <MoreStack.Screen name="Support" component={SupportScreen} />
      <MoreStack.Screen name="Documents" component={DocumentsScreen} />
      <MoreStack.Screen name="Assets" component={AssetsScreen} />
      <MoreStack.Screen
        name="ExitManagement"
        component={ExitManagementScreen}
      />
    </MoreStack.Navigator>
  );
}

const TAB_ICONS: Record<string, any> = {
  Home: Home,
  Employees: Users,
  Attendance: Clock,
  Leave: Calendar,
  More: Grid,
};

export default function MainNavigator() {
  const { user } = useAuth();
  const isEmployee = user?.role === 'employee';
  const insets = useSafeAreaInsets();
  const tabBarHeight = 64 + insets.bottom;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => {
        const Icon = TAB_ICONS[route.name] || Home;
        return {
          headerShown: false,
          tabBarStyle: [styles.tabBar, { height: tabBarHeight, paddingBottom: insets.bottom + 4 }],
          tabBarActiveTintColor: C.primary,
          tabBarInactiveTintColor: '#9CA3AF',
          tabBarLabelStyle: styles.tabLabel,
          tabBarIcon: ({ focused, color }) => (
            <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
              <Icon size={20} color={color} />
            </View>
          ),
        };
      }}
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
  tabBar: {
    borderTopWidth: 2,
    borderTopColor: '#000',
    backgroundColor: '#fff',
    paddingTop: 4,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  iconWrap: {
    width: 32,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: {},
});
