import { useState, useEffect } from 'react';
import { notificationService } from '@/lib/notification-service';

export const useNotifications = () => {
    const [isEnabled, setIsEnabled] = useState(false);
    const [isSupported, setIsSupported] = useState(false);

    useEffect(() => {
        setIsSupported('Notification' in window);
        setIsEnabled(notificationService.isEnabled());
    }, []);

    const requestPermission = async () => {
        const granted = await notificationService.requestPermission();
        setIsEnabled(granted);
        return granted;
    };

    return {
        isEnabled,
        isSupported,
        requestPermission,
        notifyNewOrder: notificationService.notifyNewOrder.bind(notificationService),
        notifyWaiterCall: notificationService.notifyWaiterCall.bind(notificationService),
        notifyBillRequest: notificationService.notifyBillRequest.bind(notificationService),
        notifyLowStock: notificationService.notifyLowStock.bind(notificationService),
    };
};
