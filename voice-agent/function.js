import functions from '@google-cloud/functions-framework';
import { GoogleAuth } from 'google-auth-library';

async function getAccessToken() {
	const auth = new GoogleAuth({
		scopes: 'https://www.googleapis.com/auth/cloud-platform',
	});
	const token = await auth.getAccessToken();
	return token;
}

functions.http('getAccessToken', async (req, res) => {
	const token = await getAccessToken();
	res.send(token);
});
