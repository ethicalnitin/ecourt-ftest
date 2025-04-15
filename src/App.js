import React, { useState, useEffect } from 'react';

function App() {
    const [initialCookies, setInitialCookies] = useState('');
    const [loadingInitialData, setLoadingInitialData] = useState(true);
    const [districtsResponse, setDistrictsResponse] = useState(null);
    const [complexesResponse, setComplexesResponse] = useState(null);
    const [setLocationResponse, setSetLocationResponse] = useState(null);
    const [captchaImage, setCaptchaImage] = useState('');
    const [searchPartyResponse, setSearchPartyResponse] = useState(null);
    const [error, setError] = useState(null);
    const [selectedStateCode, setSelectedStateCode] = useState('');
    const [selectedDistCode, setSelectedDistCode] = useState('');
    const [selectedComplexCode, setSelectedComplexCode] = useState('');
    const [captchaAppToken, setCaptchaAppToken] = useState(''); // State to store captcha app_token

    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                const response = await fetch('https://lawyerverifyandcases.onrender.com/auth/initial-data');
                if (!response.ok) {
                    const errorData = await response.json();
                    setError(errorData.error || `Error fetching initial data: ${response.status}`);
                    setLoadingInitialData(false);
                    return;
                }
                const data = await response.json();
                setInitialCookies(data.cookies);
                setLoadingInitialData(false);
            } catch (err) {
                setError(err.message || 'An unexpected error occurred while fetching initial data');
                setLoadingInitialData(false);
            }
        };

        fetchInitialData();
    }, []);

    const handleApiCall = async (endpoint, data, setResponse) => {
        if (loadingInitialData) {
            setError('Waiting for initial data to load...');
            return;
        }

        try {
            const response = await fetch(`https://lawyerverifyandcases.onrender.com/api/ecourts/${endpoint}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ ...data, cookies: initialCookies }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                setError(errorData.error || `Error: ${response.status}`);
                setResponse(null);
                return;
            }

            const responseData = await response.json();
            setResponse(responseData);
            setError(null);
            return responseData; // Return response data for chaining
        } catch (err) {
            setError(err.message || 'An unexpected error occurred');
            setResponse(null);
            return null;
        }
    };

    const handleGetDistricts = async (event) => {
        event.preventDefault();
        const formData = new FormData(event.target);
        const stateCode = formData.get('state_code');
        setSelectedStateCode(stateCode);
        const data = {
            state_code: stateCode,
        };
        await handleApiCall('districts', data, setDistrictsResponse);
        setComplexesResponse(null); // Reset complexes on state change
        setCaptchaImage('');
        setCaptchaAppToken('');
    };

    const handleGetComplexes = async (event) => {
        event.preventDefault();
        const formData = new FormData(event.target);
        const distCode = formData.get('dist_code');
        setSelectedDistCode(distCode);
        const data = {
            state_code: selectedStateCode,
            dist_code: distCode,
        };
        const complexesData = await handleApiCall('complexes', data, setComplexesResponse);
        if (complexesData) {
            // Fetch captcha after successfully getting complexes
            try {
                const captchaResponse = await fetch('https://lawyerverifyandcases.onrender.com/api/ecourts/fetchCaptcha', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({}),
                });

                if (!captchaResponse.ok) {
                    const errorData = await captchaResponse.json();
                    setError(errorData.error || `Error fetching captcha: ${captchaResponse.status}`);
                    setCaptchaImage('');
                    setCaptchaAppToken('');
                    return;
                }

                const captchaData = await captchaResponse.json();
                setCaptchaImage(captchaData.imageUrl);
                setCaptchaAppToken(captchaData.appToken); // Store the captcha app_token
                setError(null);
            } catch (err) {
                setError(err.message || 'An unexpected error occurred while fetching captcha');
                setCaptchaImage('');
                setCaptchaAppToken('');
            }
        }
    };

    const handleSetLocation = async (event) => {
        event.preventDefault();
        const formData = new FormData(event.target);
        const complexCode = formData.get('complex_code');
        setSelectedComplexCode(complexCode);
        const data = {
            complex_code: complexCode,
            selected_state_code: selectedStateCode,
            selected_dist_code: selectedDistCode,
            selected_est_code: formData.get('selected_est_code') || null,
        };
        await handleApiCall('set-location', data, setSetLocationResponse);
    };

    const handleSearchParty = (event) => {
        event.preventDefault();
        const formData = new FormData(event.target);
        const data = {
            petres_name: formData.get('petres_name'),
            rgyearP: formData.get('rgyearP'),
            case_status: formData.get('case_status') || 'Pending',
            fcaptcha_code: formData.get('fcaptcha_code'),
            state_code: selectedStateCode,
            dist_code: selectedDistCode,
            court_complex_code: selectedComplexCode,
            est_code: formData.get('est_code') || null,
            captchaAppToken: captchaAppToken, // Send the captcha app_token
        };
        handleApiCall('search-party', data, setSearchPartyResponse);
    };

    if (loadingInitialData) {
        return <div>Loading initial data...</div>;
    }

    return (
        <div style={{ fontFamily: 'Arial, sans-serif', padding: '20px' }}>
            <h1>eCourts API Tester</h1>

            {error && <div style={{ color: 'red', marginBottom: '10px' }}>Error: {error}</div>}

            <div style={{ border: '1px solid #ccc', padding: '15px', marginBottom: '20px' }}>
                <h2>Step 1: Get Districts</h2>
                <form onSubmit={handleGetDistricts}>
                    <label htmlFor="state_code">State Code:</label>
                    <input type="text" id="state_code" name="state_code" required style={{ margin: '5px 0', display: 'block', width: '300px', padding: '8px' }} />
                    <button type="submit" style={{ padding: '10px 15px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>Get Districts</button>
                </form>
                {districtsResponse && (
                    <div style={{ marginTop: '10px', border: '1px solid #eee', padding: '10px', backgroundColor: '#f9f9f9' }}>
                        <h3>Districts Response:</h3>
                        <pre>{JSON.stringify(districtsResponse, null, 2)}</pre>
                    </div>
                )}
            </div>

            <div style={{ border: '1px solid #ccc', padding: '15px', marginBottom: '20px' }}>
                <h2>Step 2: Get Complexes & Captcha</h2>
                <form onSubmit={handleGetComplexes}>
                    <label htmlFor="dist_code">District Code:</label>
                    <input type="text" id="dist_code" name="dist_code" required style={{ margin: '5px 0', display: 'block', width: '300px', padding: '8px' }} />
                    <button type="submit" style={{ padding: '10px 15px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>Get Complexes & Captcha</button>
                </form>
                {complexesResponse && (
                    <div style={{ marginTop: '10px', border: '1px solid #eee', padding: '10px', backgroundColor: '#f9f9f9' }}>
                        <h3>Complexes Response:</h3>
                        <pre>{JSON.stringify(complexesResponse, null, 2)}</pre>
                        {captchaImage && (
                            <div style={{ marginTop: '10px' }}>
                                <h2>Captcha</h2>
                                <img src={captchaImage} alt="CAPTCHA" style={{ border: '1px solid #ccc' }} />
                                <label htmlFor="fcaptcha_code">Captcha Code:</label>
                                <input type="text" id="fcaptcha_code" name="fcaptcha_code" required style={{ margin: '5px 0', display: 'block', width: '300px', padding: '8px' }} />
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div style={{ border: '1px solid #ccc', padding: '15px', marginBottom: '20px' }}>
                <h2>Step 3: Set Location</h2>
                <form onSubmit={handleSetLocation}>
                    <label htmlFor="complex_code">Complex Code:</label>
                    <input type="text" id="complex_code" name="complex_code" required style={{ margin: '5px 0', display: 'block', width: '300px', padding: '8px' }} />
                    <label htmlFor="selected_est_code">Establishment Code (Optional):</label>
                    <input type="text" id="selected_est_code" name="selected_est_code" style={{ margin: '5px 0', display: 'block', width: '300px', padding: '8px' }} />
                    <button type="submit" style={{ padding: '10px 15px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>Set Location</button>
                </form>
                {setLocationResponse && (
                    <div style={{ marginTop: '10px', border: '1px solid #eee', padding: '10px', backgroundColor: '#f9f9f9' }}>
                        <h3>Set Location Response:</h3>
                        <pre>{JSON.stringify(setLocationResponse, null, 2)}</pre>
                    </div>
                )}
            </div>

            <div style={{ border: '1px solid #ccc', padding: '15px', marginBottom: '20px' }}>
                <h2>Step 4: Search Party</h2>
                <form onSubmit={handleSearchParty}>
                    <label htmlFor="petres_name">Party Name:</label>
                    <input type="text" id="petres_name" name="petres_name" required style={{ margin: '5px 0', display: 'block', width: '300px', padding: '8px' }} />

                    <label htmlFor="rgyearP">Registration Year:</label>
                    <input type="text" id="rgyearP" name="rgyearP" required style={{ margin: '5px 0', display: 'block', width: '300px', padding: '8px' }} />

                    <label htmlFor="case_status">Case Status:</label>
                    <select id="case_status" name="case_status" style={{ margin: '5px 0', display: 'block', width: '300px', padding: '8px' }}>
                        <option value="Pending">Pending</option>
                        <option value="Disposed">Disposed</option>
                    </select>

                    <label htmlFor="fcaptcha_code">Captcha Code:</label>
                    <input type="text" id="fcaptcha_code" name="fcaptcha_code" required style={{ margin: '5px 0', display: 'block', width: '300px', padding: '8px' }} />

                    <label htmlFor="est_code">Establishment Code (Optional):</label>
                    <input type="text" id="est_code" name="est_code" style={{ margin: '5px 0', display: 'block', width: '300px', padding: '8px' }} />

                    <button type="submit" style={{ padding: '10px 15px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>Search Party</button>
                </form>
                {searchPartyResponse && (
                    <div style={{ marginTop: '10px', border: '1px solid #eee', padding: '10px', backgroundColor: '#f9f9f9' }}>
                        <h3>Search Party Response:</h3>
                        <pre>{JSON.stringify(searchPartyResponse, null, 2)}</pre>
                    </div>
                )}
            </div>
        </div>
    );
}

export default App;
