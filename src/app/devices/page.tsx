import React, { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useRouter } from 'next/router';
import { getDevices } from '../../services/deviceService';

const DevicesPage = () => {
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();
  const [devices, setDevices] = useState([]);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    } else {
      fetchDevices();
    }
  }, [isAuthenticated]);

  const fetchDevices = async () => {
    try {
      const devicesData = await getDevices(user.token);
      setDevices(devicesData);
    } catch (error) {
      console.error('Error fetching devices:', error);
    }
  };

  return (
    <div>
      <h1>Devices</h1>
      <ul>
        {devices.map((device) => (
          <li key={device.id}>{device.name}</li>
        ))}
      </ul>
    </div>
  );
};

export default DevicesPage;