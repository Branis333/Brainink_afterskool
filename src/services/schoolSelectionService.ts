// /**
//  * School Selection Service for React Native
//  * Handles school and role selection after authentication
//  */

// // Get the correct backend URL based on environment
// const getBackendUrl = () => {
//     // In React Native, we'll always use the production backend
//     return 'https://brainink-backend.onrender.com';
// };

// export interface School {
//     id: number;
//     name: string;
//     address?: string;
//     principal_id?: number;
//     created_date?: string;
// }

// export interface InvitationResponse {
//     id: number;
//     email: string;
//     invitation_type: 'teacher' | 'student';
//     school_id: number;
//     school_name: string;
//     invited_by: number;
//     invited_date: string;
//     is_used: boolean;
//     used_date?: string;
//     is_active: boolean;
// }

// export interface JoinSchoolResponse {
//     message: string;
//     school_id: number;
//     school_name: string;
//     role_assigned: string;
//     teacher_id?: number;
//     student_id?: number;
// }

// class SchoolSelectionService {
//     private async makeAuthenticatedRequest(
//         endpoint: string,
//         token: string,
//         method: 'GET' | 'POST' | 'DELETE' = 'GET',
//         body?: any
//     ): Promise<Response> {
//         if (!token) {
//             throw new Error('Authentication token is required');
//         }

//         const headers: HeadersInit = {
//             'Authorization': `Bearer ${token}`,
//             'Content-Type': 'application/json'
//         };

//         const config: RequestInit = {
//             method,
//             headers
//         };

//         if (body && (method === 'POST' || method === 'DELETE')) {
//             config.body = JSON.stringify(body);
//         }

//         const response = await fetch(`${getBackendUrl()}${endpoint}`, config);

//         if (!response.ok) {
//             const errorData = await response.json();
//             const errorMessage = errorData.detail || errorData.message || `HTTP ${response.status}: ${response.statusText}`;
//             console.error('API Error:', errorData);
//             throw new Error(errorMessage);
//         }

//         return response;
//     }

//     /**
//      * Get available schools for user
//      */
//     async getAvailableSchools(token: string): Promise<School[]> {
//         try {
//             console.log('🏫 Fetching available schools...');
//             const response = await this.makeAuthenticatedRequest(
//                 '/study-area/schools/available',
//                 token
//             );

//             const data = await response.json();
//             console.log('✅ Available schools received:', data);

//             // Transform the response to our School interface
//             return data.map((item: any) => ({
//                 id: item.id,
//                 name: item.name,
//                 address: item.address,
//                 principal_id: item.principal_id,
//                 created_date: item.created_date
//             }));
//         } catch (error) {
//             console.error('❌ Error fetching available schools:', error);
//             throw error;
//         }
//     }

//     /**
//      * Check eligibility for joining schools and get available invitations
//      */
//     async getAvailableInvitations(token: string): Promise<InvitationResponse[]> {
//         try {
//             const response = await this.makeAuthenticatedRequest(
//                 '/school-selection/check-join-eligibility',
//                 token
//             );

//             return await response.json();
//         } catch (error) {
//             console.error('Error getting invitations:', error);
//             // Return empty array if endpoint doesn't exist
//             return [];
//         }
//     }

//     /**
//      * Accept invitation as teacher
//      */
//     async acceptTeacherInvitation(schoolId: number, token: string): Promise<{ success: boolean; message: string; school_id?: number; school_name?: string; role?: string }> {
//         try {
//             console.log('👩‍🏫 Accepting teacher invitation...');
//             const response = await this.makeAuthenticatedRequest(
//                 '/study-area/join-school/teacher',
//                 token,
//                 'POST',
//                 { school_id: schoolId }
//             );
//             const data = await response.json();
//             console.log('✅ Successfully accepted teacher invitation:', data);

//             return {
//                 success: true,
//                 message: data.message,
//                 school_id: data.school_id,
//                 school_name: data.school_name,
//                 role: data.role || 'teacher'
//             };
//         } catch (error) {
//             console.error('❌ Error accepting teacher invitation:', error);
//             throw error;
//         }
//     }

//     /**
//      * Accept invitation as student
//      */
//     async acceptStudentInvitation(schoolId: number, token: string): Promise<{ success: boolean; message: string; school_id?: number; school_name?: string; role?: string }> {
//         try {
//             console.log('👨‍🎓 Accepting student invitation...');
//             const response = await this.makeAuthenticatedRequest(
//                 '/study-area/join-school/student',
//                 token,
//                 'POST',
//                 { school_id: schoolId }
//             );
//             const data = await response.json();
//             console.log('✅ Successfully accepted student invitation:', data);

//             return {
//                 success: true,
//                 message: data.message,
//                 school_id: data.school_id,
//                 school_name: data.school_name,
//                 role: data.role || 'student'
//             };
//         } catch (error) {
//             console.error('❌ Error accepting student invitation:', error);
//             throw error;
//         }
//     }

//     /**
//      * Select school as principal
//      */
//     async selectSchoolAsPrincipal(schoolId: number, email: string, token: string): Promise<{ success: boolean; message?: string; school_id?: number; school_name?: string; role?: string }> {
//         try {
//             console.log('👔 Selecting school as principal...');
//             const response = await this.makeAuthenticatedRequest(
//                 '/study-area/login-school/select-principal',
//                 token,
//                 'POST',
//                 {
//                     school_id: schoolId,
//                     email: email
//                 }
//             );
//             const data = await response.json();
//             console.log('✅ Successfully selected principal role:', data);
//             return {
//                 success: true,
//                 message: data.message,
//                 school_id: data.school_id,
//                 school_name: data.school_name,
//                 role: data.role || 'principal'
//             };
//         } catch (error) {
//             console.error('❌ Error selecting principal role:', error);
//             throw error;
//         }
//     }

//     /**
//      * Select school as teacher
//      */
//     async selectSchoolAsTeacher(schoolId: number, email: string, token: string): Promise<{ success: boolean; message?: string; school_id?: number; school_name?: string; role?: string }> {
//         try {
//             console.log('👩‍🏫 Selecting school as teacher...');
//             const response = await this.makeAuthenticatedRequest(
//                 '/study-area/login-school/select-teacher',
//                 token,
//                 'POST',
//                 {
//                     school_id: schoolId,
//                     email: email
//                 }
//             );
//             const data = await response.json();
//             console.log('✅ Successfully selected teacher role:', data);
//             return {
//                 success: true,
//                 message: data.message,
//                 school_id: data.school_id,
//                 school_name: data.school_name,
//                 role: data.role || 'teacher'
//             };
//         } catch (error) {
//             console.error('❌ Error selecting teacher role:', error);
//             throw error;
//         }
//     }

//     /**
//      * Join school by email
//      */
//     async joinSchoolByEmail(email: string, token: string): Promise<JoinSchoolResponse> {
//         try {
//             console.log('🏫 Joining school by email...');
//             const response = await this.makeAuthenticatedRequest(
//                 '/study-area/join-school-by-email',
//                 token,
//                 'POST',
//                 { email }
//             );
//             const data = await response.json();
//             console.log('✅ Successfully joined school:', data);
//             return data;
//         } catch (error) {
//             console.error('❌ Error joining school:', error);
//             throw error;
//         }
//     }
// }

// export const schoolSelectionService = new SchoolSelectionService();