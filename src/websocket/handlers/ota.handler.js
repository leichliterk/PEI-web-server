const OtaRelease = require('../../models/otaRelease.model');
const OtaReleaseResponse = require('../../models/otaReleaseResponse.model');

const otaHandler = {

    /**
     * Desktop emits: ota:response { release_id, accepted }
     * Records the user's accept/decline decision for this site.
     */
    async onOtaResponse(socket, data) {
        const { release_id, accepted } = data || {};
        const { tenant_id, site_id } = socket.siteData;

        if (!release_id || typeof accepted !== 'boolean') {
            return socket.emit('ota:response_ack', { success: false, error: 'Invalid payload' });
        }

        try {
            const release = await OtaRelease.findById(release_id);
            if (!release || release.tenant_id !== tenant_id) {
                return socket.emit('ota:response_ack', { success: false, error: 'Release not found' });
            }

            // Upsert so the desktop can re-respond if the user changes their mind
            await OtaReleaseResponse.findOneAndUpdate(
                { release_id, tenant_id, site_id },
                { accepted, responded_at: new Date() },
                { upsert: true, new: true }
            );

            socket.emit('ota:response_ack', { success: true });
            console.log(`OTA response from ${tenant_id}-${site_id}: release ${release_id} ${accepted ? 'accepted' : 'declined'}`);
        } catch (err) {
            console.error('Error recording OTA response:', err);
            socket.emit('ota:response_ack', { success: false, error: 'Server error' });
        }
    },

    /**
     * Desktop emits: ota:installed { release_id, version }
     * Records successful installation. Desktop should emit this before restarting.
     */
    async onOtaInstalled(socket, data) {
        const { release_id, version } = data || {};
        const { tenant_id, site_id } = socket.siteData;

        if (!release_id || !version) return;

        try {
            await OtaReleaseResponse.findOneAndUpdate(
                { release_id, tenant_id, site_id },
                { installed_at: new Date(), installed_version: version },
                { upsert: true }
            );
            console.log(`OTA install confirmed from ${tenant_id}-${site_id}: v${version}`);
        } catch (err) {
            console.error('Error recording OTA install:', err);
        }
    }
};

module.exports = otaHandler;
