import React, { useState, useEffect } from 'react';

// Base URL for your backend API
const API_BASE_URL = 'https://lawyerverifyandcases.onrender.com/api/ecourts';

function App() {
    // State to hold the app_token needed for the *next* API call
    const [nextAppToken, setNextAppToken] = useState(null);

    // State for loading/error
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [message, setMessage] = useState(null); // For success messages or info

    // State for storing data received from each step
    const [districts, setDistricts] = useState([]);
    const [complexes, setComplexes] = useState([]);
    const [captchaImageUrl, setCaptchaImageUrl] = useState('');
    const [searchResults, setSearchResults] = useState(null);

    // State for user selections (needed for later steps)
    const [selectedStateCode, setSelectedStateCode] = useState('');
    const [selectedDistCode, setSelectedDistCode] = useState('');
    const [selectedComplexCode, setSelectedComplexCode] = useState('');
    const [selectedEstCode, setSelectedEstCode] = useState(''); // Optional Est Code

    // State for search form inputs
    const [partyNameInput, setPartyNameInput] = useState('');
    const [yearInput, setYearInput] = useState('');
    const [caseStatusInput, setCaseStatusInput] = useState('Pending'); // Default
    const [captchaInput, setCaptchaInput] = useState('');

    // --- Step 1: Get Initial Data & Token ---
    useEffect(() => {
        const fetchInitialData = async () => {
            setLoading(true);
            setError(null);
            setMessage('Fetching initial data...');
            try {
                // This calls your backend's /auth/initial-data which should
                // initialize the session and return the *first* app_token.
                // The backend handles the cookies in the session.
                const response = await fetch('https://lawyerverifyandcases.onrender.com/api/ecourts/initial-data'); // Check this URL matches your auth route

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || `Error fetching initial data: ${response.status}`);
                }

                const data = await response.json();
                // The backend should return { app_token: '...' } here based on your backend code
                if (data.app_token) {
                    setNextAppToken(data.app_token); // Store the token for the next step (/districts)
                    setMessage(`Initial data fetched. Ready for districts.`);
                } else {
                    throw new Error('Initial data response missing app_token.');
                }

            } catch (err) {
                console.error("Initial data fetch error:", err);
                setError(err.message || 'An unexpected error occurred while fetching initial data');
                setMessage(null);
            } finally {
                setLoading(false);
            }
        };

        fetchInitialData();
    }, []); // Empty dependency array means this runs once on mount

    // --- Generic API Call Helper ---
    // This helper now automatically includes the nextAppToken in the body
    const callBackendApi = async (endpoint, data = {}) => {
         if (!nextAppToken && endpoint !== '/initial-data') {
             throw new Error('App token is missing. Please restart the process.');
         }

        const url = `${API_BASE_URL}${endpoint}`;
        console.log(`Calling ${url} with token: ${nextAppToken}`);
        // Always include the current nextAppToken in the request body
        const requestBody = { ...data, app_token: nextAppToken };

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
        });

        const responseData = await response.json();

        if (!response.ok) {
            // Handle HTTP errors (e.g., 400 from backend for missing params, 500 from backend)
            console.error(`Backend responded with error status ${response.status}:`, responseData);
            throw new Error(responseData.error || `Backend error: ${response.status}`);
        }

        // Check for eCourts specific errors returned *within* the 200 OK response body
        // Your backend /search-party route might return this structure
        if (responseData.results && responseData.results.status === 0 && responseData.results.errormsg) {
             console.warn('eCourts API application error:', responseData);
             // The backend should ideally handle this and throw, but this is a safeguard
             // If the backend doesn't throw on status 0, you might need to parse
             // responseData.results.div_captcha here and handle it as a captcha error retry.
             // Assuming backend throws:
             throw new Error(`eCourts API error: ${responseData.results.errormsg}`);
        }

        console.log(`Received data from ${endpoint}:`, responseData);

         // **Crucially: Update the nextAppToken for the subsequent step**
         // Your backend endpoints return the new token as 'app_token' or 'next_app_token'
         // Let's adjust the backend code to consistently use 'app_token' for the *next* token.
         // Based on your backend code snippet, it seems to return 'app_token' or 'next_app_token'.
         // Let's check for both possibilities returned by the backend.
         if (responseData.app_token || responseData.next_app_token) {
             const newToken = responseData.app_token || responseData.next_app_token;
             console.log(`Updating nextAppToken from response (${endpoint}): ${newToken}`);
             setNextAppToken(newToken); // Update state for the *next* call
         } else {
              console.warn(`API call to ${endpoint} did not return a new app_token.`);
              // Keep the old token if no new one is provided.
         }


        return responseData; // Return the full successful response data
    };

    // --- Step 2: Get Districts ---
    const handleGetDistricts = async (event) => {
        event.preventDefault();
        setLoading(true);
        setError(null);
        setMessage('Fetching districts...');
        setDistricts([]); // Clear previous districts
        setComplexes([]); // Clear downstream data
        setCaptchaImageUrl('');
        setSearchResults(null);

        const stateCode = event.target.elements.stateCode.value;
        setSelectedStateCode(stateCode);
        setSelectedDistCode(''); // Clear district selection
        setSelectedComplexCode(''); // Clear complex selection
        setSelectedEstCode('');

        if (!stateCode) {
            setError('Please enter a State Code.');
            setLoading(false);
            setMessage(null);
            return;
        }

        try {
            const data = await callBackendApi('/districts', { state_code: stateCode });
            if (data.districts && Array.isArray(data.districts)) {
                setDistricts(data.districts);
                setMessage(`Found ${data.districts.length} districts. Select one.`);
            } else {
                 setDistricts([]); // Ensure it's an empty array if backend returns something unexpected
                 setMessage('Districts request successful, but no districts found or unexpected format.');
            }

        } catch (err) {
            setError(err.message || 'Failed to fetch districts.');
            setMessage(null);
        } finally {
            setLoading(false);
        }
    };

     // --- Step 3: Get Complexes ---
    const handleGetComplexes = async () => {
        setLoading(true);
        setError(null);
        setMessage('Fetching complexes...');
        setComplexes([]); // Clear previous complexes
        setCaptchaImageUrl(''); // Clear downstream data
        setSearchResults(null);

         // selectedDistCode is already set when the select changes
        if (!selectedStateCode || !selectedDistCode) {
            setError('Please select a State and District.');
             setLoading(false);
             setMessage(null);
            return;
        }

        try {
            const data = await callBackendApi('/complexes', {
                state_code: selectedStateCode,
                dist_code: selectedDistCode
            });

            if (data.complexes && Array.isArray(data.complexes)) {
                setComplexes(data.complexes);
                 setMessage(`Found ${data.complexes.length} complexes. Select one.`);
            } else {
                 setComplexes([]); // Ensure empty array
                  setMessage('Complexes request successful, but no complexes found or unexpected format.');
            }

        } catch (err) {
            setError(err.message || 'Failed to fetch complexes.');
            setMessage(null);
        } finally {
            setLoading(false);
        }
    };

     // --- Step 4: Set Location ---
     // Note: Your backend /set-location expects state_code, dist_code, complex_code, est_code
     // The complex_code is selected in the UI, est_code comes from input.
     const handleSetLocation = async (event) => {
         event.preventDefault();
         setLoading(true);
         setError(null);
         setMessage('Setting location...');

         const complexCode = event.target.elements.complexCode.value;
         const estCode = event.target.elements.selectedEstCode.value; // Get from form

         setSelectedComplexCode(complexCode);
         setSelectedEstCode(estCode);

          if (!selectedStateCode || !selectedDistCode || !complexCode) {
             setError('Please select State, District, and Complex.');
             setLoading(false);
             setMessage(null);
            return;
         }

         try {
             const data = await callBackendApi('/set-location', {
                complex_code: complexCode,
                selected_state_code: selectedStateCode, // Use stored state
                selected_dist_code: selectedDistCode, // Use stored district
                selected_est_code: estCode || null, // Pass null if empty
             });

             // Assuming set-location returns a confirmation or some data in `result`
             setMessage(`Location set successfully. Result: ${JSON.stringify(data.result)}`);

         } catch (err) {
             setError(err.message || 'Failed to set location.');
             setMessage(null);
         } finally {
             setLoading(false);
         }
     };


    // --- Step 5: Fetch Captcha ---
    // This step should be called *after* setting the location
    const handleFetchCaptcha = async () => {
        setLoading(true);
        setError(null);
        setMessage('Fetching captcha...');
        setCaptchaImageUrl(''); // Clear previous captcha

         // Location must be set before fetching captcha
         if (!selectedStateCode || !selectedDistCode || !selectedComplexCode) {
              setError('Please set location first (Steps 1-4).');
              setLoading(false);
              setMessage(null);
              return;
         }

        try {
            // The fetchCaptcha endpoint on your backend expects the token from the previous step
            const data = await callBackendApi('/fetch-user-captcha', {}); // No extra data needed beyond the app_token in the helper

            if (data.imageUrl) {
                // The imageUrl might be relative. Fetch handles this based on your frontend's host.
                 // If backend serves from a different origin, ensure CORS allows image loading
                 // or proxy the image request through your backend.
                setCaptchaImageUrl(data.imageUrl);
                setMessage('Captcha image fetched. Please enter the code below.');
            } else {
                throw new Error('Captcha response missing imageUrl.');
            }

        } catch (err) {
            setError(err.message || 'Failed to fetch captcha.');
            setMessage(null);
            setCaptchaImageUrl('');
        } finally {
            setLoading(false);
        }
    };


    // --- Step 6: Search Party ---
    const handleSearchParty = async (event) => {
        event.preventDefault();
        setLoading(true);
        setError(null);
        setMessage('Performing search...');
        setSearchResults(null); // Clear previous results

        const partyName = partyNameInput; // Use state for inputs
        const year = yearInput;
        const caseStatus = caseStatusInput;
        const captchaCode = captchaInput;
        const estCode = selectedEstCode; // Use the stored optional est code

        // Your backend expects these codes and the token
        if (!partyName || !year || !captchaCode || !selectedStateCode || !selectedDistCode || !selectedComplexCode) {
             setError('Please fill all required search fields and ensure location is set.');
             setLoading(false);
             setMessage(null);
            return;
        }

         // Ensure captcha image was successfully fetched and we have a token for this step
         if (!captchaImageUrl || !nextAppToken) {
              setError('Captcha not fetched or token is missing. Complete Step 5.');
              setLoading(false);
              setMessage(null);
              return;
         }


        try {
            // Pass all required parameters to the backend /search-party endpoint
            const data = await callBackendApi('/search-party', {
                petres_name: partyName,
                rgyearP: year,
                case_status: caseStatus,
                fcaptcha_code: captchaCode,
                state_code: selectedStateCode,
                dist_code: selectedDistCode,
                court_complex_code: selectedComplexCode,
                est_code: estCode || null, // Pass optional est_code if available
                // app_token is automatically included by callBackendApi helper
            });

            // Assuming data.results contains the final search response from eCourts
            if (data.results) {
                 setSearchResults(data.results);
                 setMessage('Search completed.');

                 // Check if the search results indicate an invalid captcha from eCourts itself
                 if (data.results.status === 0 && data.results.errormsg && data.results.errormsg.includes('Invalid Captcha')) {
                      setError('Search failed: Invalid Captcha. Please try fetching a new captcha (Step 5) and try searching again.');
                      // Optionally clear captcha related state to force re-fetch
                      setCaptchaImageUrl('');
                      setCaptchaInput('');
                      // The nextAppToken will already be updated by callBackendApi if the response contained one
                      setMessage(null); // Clear success message
                 } else if (data.results.status === 0 && data.results.errormsg) {
                      // Handle other eCourts errors
                      setError(`Search failed: ${data.results.errormsg}`);
                       setMessage(null);
                 } else {
                     // Assume success if status is not 0 or no errormsg
                     setError(null); // Clear any previous error
                     setMessage('Search successful!');
                 }

            } else {
                // Handle cases where backend didn't return the expected results structure
                 throw new Error('Search response missing results data.');
            }


        } catch (err) {
            // This catches network errors or errors thrown by callBackendApi (including backend errors)
            setError(err.message || 'Failed to perform search.');
            setMessage(null);
             setSearchResults(null); // Clear previous results on error
        } finally {
            setLoading(false);
        }
    };


    // --- UI Rendering ---
    return (
        <div style={{ fontFamily: 'Arial, sans-serif', padding: '20px', maxWidth: '800px', margin: 'auto' }}>
            <h1>eCourts API Tester</h1>

            <p><strong>Backend Status:</strong> {loading ? <span style={{color:'orange'}}>Loading...</span> : <span style={{color:'green'}}>Idle</span>}</p>
            {message && <p style={{ color: 'blue' }}>{message}</p>}
            {error && <p style={{ color: 'red', fontWeight: 'bold' }}>Error: {error}</p>}
            <p><strong>Current Token for Next Step:</strong> {nextAppToken || 'N/A'}</p>


             {/* Steps guided by the presence of nextAppToken */}

            <div style={{ border: '1px solid #ccc', padding: '15px', marginBottom: '20px', opacity: nextAppToken ? 1 : 0.5, pointerEvents: nextAppToken ? 'auto' : 'none' }}>
                 <h2>Step 1: Get Districts</h2>
                 <p>Initial Data & Token should be fetched automatically on load.</p>
                 <form onSubmit={handleGetDistricts}>
                     <label htmlFor="stateCode">State Code:</label>
                     <input type="text" id="stateCode" name="stateCode" required value={selectedStateCode} onChange={e => setSelectedStateCode(e.target.value)} disabled={loading} style={{ margin: '5px 0', display: 'block', width: '300px', padding: '8px' }} />
                     <button type="submit" disabled={loading || !nextAppToken} style={{ padding: '10px 15px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>Get Districts</button>
                 </form>

                 {districts.length > 0 && (
                     <div style={{ marginTop: '10px' }}>
                         <label htmlFor="districtCode">Select District:</label>
                         <select id="districtCode" value={selectedDistCode} onChange={e => setSelectedDistCode(e.target.value)} disabled={loading} style={{ margin: '5px 0', display: 'block', width: '300px', padding: '8px' }}>
                             <option value="">-- Select District --</option>
                             {districts.map(dist => (
                                 <option key={dist.dist_code} value={dist.dist_code}>{dist.dist_name}</option>
                             ))}
                         </select>
                         <button onClick={handleGetComplexes} disabled={loading || !selectedDistCode} style={{ padding: '10px 15px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>Get Complexes (Step 2)</button>
                     </div>
                 )}
             </div>


             <div style={{ border: '1px solid #ccc', padding: '15px', marginBottom: '20px', opacity: complexes.length > 0 ? 1 : 0.5, pointerEvents: complexes.length > 0 ? 'auto' : 'none' }}>
                 <h2>Step 2: Get Complexes & Set Location</h2>
                 {complexes.length > 0 && (
                     <div style={{ marginTop: '10px' }}>
                          <label htmlFor="complexCode">Select Complex:</label>
                         <select id="complexCode" value={selectedComplexCode} onChange={e => setSelectedComplexCode(e.target.value)} disabled={loading} style={{ margin: '5px 0', display: 'block', width: '300px', padding: '8px' }}>
                              <option value="">-- Select Complex --</option>
                             {complexes.map(comp => (
                                 <option key={comp.complex_code} value={comp.complex_code}>{comp.complex_name}</option>
                             ))}
                         </select>
                         <form onSubmit={handleSetLocation} style={{ marginTop: '15px' }}>
                              <label htmlFor="selectedEstCode">Establishment Code (Optional):</label>
                             <input type="text" id="selectedEstCode" name="selectedEstCode" value={selectedEstCode} onChange={e => setSelectedEstCode(e.target.value)} disabled={loading} style={{ margin: '5px 0', display: 'block', width: '300px', padding: '8px' }} placeholder="Optional" />
                             <button type="submit" disabled={loading || !selectedComplexCode} style={{ padding: '10px 15px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>Set Location (Step 3)</button>
                         </form>
                     </div>
                 )}
             </div>


            <div style={{ border: '1px solid #ccc', padding: '15px', marginBottom: '20px', opacity: selectedComplexCode ? 1 : 0.5, pointerEvents: selectedComplexCode ? 'auto' : 'none' }}>
                 <h2>Step 3: Fetch Captcha</h2>
                 <button onClick={handleFetchCaptcha} disabled={loading || !selectedComplexCode} style={{ padding: '10px 15px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>Get Captcha Image</button>

                 {captchaImageUrl && (
                     <div style={{ marginTop: '15px' }}>
                         <h3>Captcha:</h3>
                         <img src={captchaImageUrl} alt="CAPTCHA" style={{ border: '1px solid #ccc', maxWidth: '100%' }} />
                         <p style={{fontSize:'0.8em', color:'#555'}}>Enter the text from the image into the search form below.</p>
                     </div>
                 )}
             </div>


             <div style={{ border: '1px solid #ccc', padding: '15px', marginBottom: '20px', opacity: captchaImageUrl ? 1 : 0.5, pointerEvents: captchaImageUrl ? 'auto' : 'none' }}>
                 <h2>Step 4: Search Party</h2>
                 <form onSubmit={handleSearchParty}>
                     <div style={{marginBottom: '10px'}}>
                         <label htmlFor="partyNameInput">Party Name:</label>
                         <input type="text" id="partyNameInput" value={partyNameInput} onChange={e => setPartyNameInput(e.target.value)} required disabled={loading} style={{ margin: '5px 0', display: 'block', width: '300px', padding: '8px' }} />
                     </div>

                     <div style={{marginBottom: '10px'}}>
                          <label htmlFor="yearInput">Registration Year:</label>
                         <input type="text" id="yearInput" value={yearInput} onChange={e => setYearInput(e.target.value)} required disabled={loading} style={{ margin: '5px 0', display: 'block', width: '300px', padding: '8px' }} />
                     </div>

                     <div style={{marginBottom: '10px'}}>
                         <label htmlFor="caseStatusInput">Case Status:</label>
                         <select id="caseStatusInput" value={caseStatusInput} onChange={e => setCaseStatusInput(e.target.value)} disabled={loading} style={{ margin: '5px 0', display: 'block', width: '300px', padding: '8px' }}>
                             <option value="Pending">Pending</option>
                             <option value="Disposed">Disposed</option>
                             <option value="">Any</option>
                         </select>
                     </div>

                      <div style={{marginBottom: '10px'}}>
                         <label htmlFor="captchaInput">Captcha Code:</label>
                         <input type="text" id="captchaInput" value={captchaInput} onChange={e => setCaptchaInput(e.target.value)} required disabled={loading} style={{ margin: '5px 0', display: 'block', width: '300px', padding: '8px' }} placeholder="Enter captcha text from image" />
                     </div>


                     <button type="submit" disabled={loading || !captchaImageUrl} style={{ padding: '10px 15px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>Search Party</button>
                 </form>

                 {searchResults && (
                     <div style={{ marginTop: '20px', border: '1px solid #eee', padding: '15px', backgroundColor: '#f9f9f9', maxHeight: '400px', overflowY: 'auto' }}>
                         <h3>Search Results:</h3>
                         <pre>{JSON.stringify(searchResults, null, 2)}</pre>
                     </div>
                 )}
             </div>

        </div>
    );
}

export default App;
